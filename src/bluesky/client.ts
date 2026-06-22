import { AtpAgent, AtUri, RichText } from "@atproto/api";
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

const BLUESKY_LIMIT = 300; // graphemes

/**
 * Build the Bluesky post text from a note: append a permalink (POSSE backlink)
 * and truncate to fit Bluesky's grapheme limit.
 */
export function buildBlueskyText(
  noteText: string,
  permalink: string | null,
  limit = BLUESKY_LIMIT,
): string {
  const body = noteText.trim();
  const suffix = permalink != null ? `\n\n${permalink}` : "";
  const budget = limit - Array.from(suffix).length;
  const chars = Array.from(body);
  if (chars.length <= budget) return body + suffix;
  return `${chars.slice(0, Math.max(0, budget - 1)).join("")}…${suffix}`;
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
  // embed) used by both create and edit. The caller supplies `createdAt`.
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

  async post(input: {
    text: string;
    images?: BlueskyImage[];
  }): Promise<BlueskyPostResult> {
    await this.#ensureLogin();
    const record = await this.#composeRecord(input.text, input.images ?? []);
    const result = await this.#agent.post({
      ...record,
      createdAt: new Date().toISOString(),
    });
    return { uri: result.uri, cid: result.cid };
  }

  /**
   * Edit an existing post in place: overwrite the record at the same rkey so
   * the post keeps its URI (likes/reposts/replies survive). The original
   * `createdAt` is preserved so the edit doesn't re-sort the timeline.
   */
  async updatePost(
    uri: string,
    input: { text: string; images?: BlueskyImage[] },
  ): Promise<BlueskyPostResult> {
    await this.#ensureLogin();
    const at = new AtUri(uri);
    const record = await this.#composeRecord(input.text, input.images ?? []);
    const result = await this.#agent.com.atproto.repo.putRecord({
      repo: at.hostname,
      collection: at.collection,
      rkey: at.rkey,
      record: {
        $type: "app.bsky.feed.post",
        ...record,
        createdAt: await this.#originalCreatedAt(at),
      },
    });
    return { uri: result.data.uri, cid: result.data.cid };
  }

  // Read an existing post's `createdAt`, falling back to now if it can't be
  // fetched, so that an edit keeps the post's original timeline position.
  async #originalCreatedAt(at: AtUri): Promise<string> {
    try {
      const existing = await this.#agent.com.atproto.repo.getRecord({
        repo: at.hostname,
        collection: at.collection,
        rkey: at.rkey,
      });
      const value = existing.data.value as { createdAt?: unknown };
      if (typeof value.createdAt === "string") return value.createdAt;
    } catch {
      // fall back to now
    }
    return new Date().toISOString();
  }

  async deletePost(uri: string): Promise<void> {
    await this.#ensureLogin();
    await this.#agent.deletePost(uri);
  }
}
