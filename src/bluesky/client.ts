import { AtpAgent, RichText } from "@atproto/api";
import type { BlueskyCredentials } from "../config.ts";

type PostRecord = Parameters<AtpAgent["post"]>[0];

export interface BlueskyPostResult {
  uri: string;
  cid: string;
}

export interface BlueskyImage {
  bytes: Uint8Array;
  contentType: string;
  alt: string | null;
}

const BLUESKY_LIMIT = 300; // graphemes per post

const graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

function graphemes(text: string): string[] {
  return Array.from(graphemeSegmenter.segment(text), (s) => s.segment);
}

function graphemeLength(text: string): number {
  let count = 0;
  for (const _ of graphemeSegmenter.segment(text)) count++;
  return count;
}

// Pack a note body into segments of at most `limit` graphemes, breaking on
// whitespace (including paragraph breaks). A single token longer than the
// limit (e.g. a very long URL) is hard-split by graphemes.
function packBody(body: string, limit: number): string[] {
  const segments: string[] = [];
  let current = "";
  const flush = () => {
    const trimmed = current.trim();
    if (trimmed !== "") segments.push(trimmed);
    current = "";
  };

  for (const token of body.split(/(\s+)/)) {
    if (token === "") continue;
    if (graphemeLength(current) + graphemeLength(token) <= limit) {
      current += token;
      continue;
    }
    if (/^\s+$/.test(token)) {
      // Whitespace that doesn't fit is a clean break point.
      flush();
      continue;
    }
    flush();
    if (graphemeLength(token) <= limit) {
      current = token;
      continue;
    }
    // Oversized single token: hard-split into limit-sized chunks.
    const chars = graphemes(token);
    for (let i = 0; i < chars.length; i += limit) {
      const chunk = chars.slice(i, i + limit).join("");
      if (graphemeLength(chunk) === limit) segments.push(chunk);
      else current = chunk;
    }
  }
  flush();
  return segments;
}

/**
 * Split a note into Bluesky-sized segments for a thread. Short notes return a
 * single segment (no behavior change). The permalink (POSSE backlink) is
 * appended to the final segment, or posted as its own trailing segment when it
 * doesn't fit. Each segment is at most `limit` graphemes.
 */
export function splitIntoThread(
  noteText: string,
  permalink: string | null,
  limit = BLUESKY_LIMIT,
  suffixWeight?: number,
): string[] {
  const body = noteText.trim();
  const suffix = permalink != null ? `\n\n${permalink}` : "";
  // How many of the limit's graphemes the suffix consumes. Defaults to its
  // literal length; callers can override (e.g. Twitter shortens any URL to 23).
  const suffixCost = suffix === "" ? 0 : suffixWeight ?? graphemeLength(suffix);

  if (graphemeLength(body) + suffixCost <= limit) {
    return [body + suffix];
  }

  const segments = packBody(body, limit);
  if (segments.length === 0) segments.push("");

  if (suffix !== "") {
    const lastIndex = segments.length - 1;
    const last = segments[lastIndex] ?? "";
    if (graphemeLength(last) + suffixCost <= limit) {
      segments[lastIndex] = last + suffix;
    } else {
      segments.push(suffix.trimStart());
    }
  }
  return segments;
}

/** Thin Bluesky (AT Protocol) client that lazily logs in with an app password. */
export class BlueskyClient {
  readonly #agent: AtpAgent;
  readonly #credentials: BlueskyCredentials;
  #loginPromise: Promise<void> | null = null;

  constructor(credentials: BlueskyCredentials) {
    this.#credentials = credentials;
    this.#agent = new AtpAgent({ service: credentials.service });
  }

  #ensureLogin(): Promise<void> {
    if (this.#loginPromise == null) {
      this.#loginPromise = this.#agent
        .login({
          identifier: this.#credentials.identifier,
          password: this.#credentials.appPassword,
        })
        .then(() => undefined)
        .catch((error: unknown) => {
          this.#loginPromise = null; // allow retry on next post
          throw error;
        });
    }
    return this.#loginPromise;
  }

  // Build the shared post body (text + detected facets + optional image
  // embed). The caller supplies `createdAt`.
  async #composeRecord(
    text: string,
    images: BlueskyImage[],
  ): Promise<PostRecord> {
    const rich = new RichText({ text });
    await rich.detectFacets(this.#agent);

    const record: PostRecord = { text: rich.text, facets: rich.facets };

    const limited = images.slice(0, 4); // Bluesky allows up to 4
    if (limited.length > 0) {
      const uploaded = await Promise.all(
        limited.map(async (image) => {
          const result = await this.#agent.uploadBlob(image.bytes, {
            encoding: image.contentType,
          });
          return { image: result.data.blob, alt: image.alt ?? "" };
        }),
      );
      record.embed = {
        $type: "app.bsky.embed.images",
        images: uploaded,
      } as typeof record.embed;
    }

    return record;
  }

  /**
   * Post a note to Bluesky. If the text exceeds the per-post grapheme limit it
   * is split into a reply-chain thread; otherwise a single post is made. Images
   * attach to the first post. Returns the root post's ref (the thread head),
   * which is what we store as the syndication target.
   */
  async post(input: {
    text: string;
    permalink?: string | null;
    images?: BlueskyImage[];
  }): Promise<BlueskyPostResult> {
    await this.#ensureLogin();
    const segments = splitIntoThread(input.text, input.permalink ?? null);

    let root: BlueskyPostResult | null = null;
    let parent: BlueskyPostResult | null = null;
    for (const segment of segments) {
      const record = await this.#composeRecord(
        segment,
        root == null ? input.images ?? [] : [],
      );
      const reply =
        root != null && parent != null
          ? {
              root: { uri: root.uri, cid: root.cid },
              parent: { uri: parent.uri, cid: parent.cid },
            }
          : undefined;
      const result = await this.#agent.post({
        ...record,
        createdAt: new Date().toISOString(),
        ...(reply != null ? { reply } : {}),
      });
      const ref = { uri: result.uri, cid: result.cid };
      root ??= ref;
      parent = ref;
    }

    return root as BlueskyPostResult;
  }

  async deletePost(uri: string): Promise<void> {
    await this.#ensureLogin();
    await this.#agent.deletePost(uri);
  }
}
