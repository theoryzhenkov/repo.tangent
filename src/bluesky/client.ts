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

type Measure = (text: string) => number;

const URL_RE = /https?:\/\/[^\s]+/gi;
const TWITTER_URL_WEIGHT = 23; // every URL shortens to a t.co link

// Twitter-weighted length: each URL counts as a fixed 23 regardless of its
// actual length; everything else counts by grapheme. Used for the X path so a
// long link doesn't push apart text that actually fits.
function twitterLength(text: string): number {
  let total = 0;
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const at = m.index ?? 0;
    total += graphemeLength(text.slice(last, at)) + TWITTER_URL_WEIGHT;
    last = at + m[0].length;
  }
  return total + graphemeLength(text.slice(last));
}

// Greedily pack a single paragraph's words into <=limit segments, breaking on
// whitespace. An oversized lone token (e.g. a giant URL under literal counting)
// is hard-split by graphemes.
function packWords(text: string, limit: number, measure: Measure): string[] {
  const segments: string[] = [];
  let current = "";
  const flush = () => {
    const t = current.trim();
    if (t !== "") segments.push(t);
    current = "";
  };

  for (const token of text.split(/(\s+)/)) {
    if (token === "") continue;
    if (measure(current) + measure(token) <= limit) {
      current += token;
      continue;
    }
    if (/^\s+$/.test(token)) {
      flush();
      continue;
    }
    flush();
    if (measure(token) <= limit) {
      current = token;
      continue;
    }
    let chunk = "";
    for (const ch of graphemes(token)) {
      if (chunk !== "" && measure(chunk + ch) > limit) {
        segments.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    current = chunk;
  }
  flush();
  return segments;
}

// Pack a body into <=limit segments, preferring paragraph boundaries: whole
// paragraphs are kept together and packed greedily; a paragraph that alone
// exceeds the limit falls back to word-splitting.
function packParagraphs(body: string, limit: number, measure: Measure): string[] {
  const segments: string[] = [];
  let current = "";

  for (const raw of body.split(/\n{2,}/)) {
    const para = raw.trim();
    if (para === "") continue;
    if (measure(para) > limit) {
      if (current !== "") {
        segments.push(current);
        current = "";
      }
      const parts = packWords(para, limit, measure);
      current = parts.pop() ?? "";
      for (const part of parts) segments.push(part);
      continue;
    }
    if (current === "") {
      current = para;
    } else if (measure(current) + 2 + measure(para) <= limit) {
      current = `${current}\n\n${para}`;
    } else {
      segments.push(current);
      current = para;
    }
  }
  if (current !== "") segments.push(current);
  return segments;
}

/**
 * Split a note into thread segments. Short notes return a single segment. The
 * permalink (POSSE backlink) is appended to the final segment, or posted as its
 * own trailing segment when it doesn't fit. Splitting prefers paragraph then
 * word boundaries. With `weighted` (Twitter), URLs count as 23 graphemes.
 */
export function splitIntoThread(
  noteText: string,
  permalink: string | null,
  opts: { limit?: number; weighted?: boolean } = {},
): string[] {
  const limit = opts.limit ?? BLUESKY_LIMIT;
  const measure: Measure = opts.weighted ? twitterLength : graphemeLength;
  const body = noteText.trim();
  const suffix = permalink != null ? `\n\n${permalink}` : "";
  const suffixCost = suffix === "" ? 0 : measure(suffix);

  if (measure(body) + suffixCost <= limit) {
    return [body + suffix];
  }

  const segments = packParagraphs(body, limit, measure);
  if (segments.length === 0) segments.push("");

  if (suffix !== "") {
    const lastIndex = segments.length - 1;
    const last = segments[lastIndex] ?? "";
    if (measure(last) + suffixCost <= limit) {
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
