import { AtpAgent, RichText } from "@atproto/api";
import type { BlueskyCredentials } from "../config.ts";

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

  async post(input: {
    text: string;
    images?: BlueskyImage[];
  }): Promise<BlueskyPostResult> {
    await this.#ensureLogin();
    const rich = new RichText({ text: input.text });
    await rich.detectFacets(this.#agent);

    const record: Parameters<AtpAgent["post"]>[0] = {
      text: rich.text,
      facets: rich.facets,
      createdAt: new Date().toISOString(),
    };

    const images = (input.images ?? []).slice(0, 4); // Bluesky allows up to 4
    if (images.length > 0) {
      const uploaded = await Promise.all(
        images.map(async (image) => {
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

    const result = await this.#agent.post(record);
    return { uri: result.uri, cid: result.cid };
  }

  async deletePost(uri: string): Promise<void> {
    await this.#ensureLogin();
    await this.#agent.deletePost(uri);
  }
}
