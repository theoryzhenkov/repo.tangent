import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import type { Database } from "../db/client.ts";
import { type Attachment, media } from "../db/schema.ts";

export type MediaRow = typeof media.$inferSelect;

export interface MediaStore {
  save(input: {
    bytes: Uint8Array;
    contentType: string;
    alt?: string | null;
  }): Promise<MediaRow>;
  get(id: string): Promise<{ row: MediaRow; bytes: Uint8Array } | null>;
  remove(id: string): Promise<void>;
  resolveAttachments(
    items: { mediaId: string; alt?: string | null }[],
  ): Promise<Attachment[]>;
}

export function createMediaStore(database: Database, dir: string): MediaStore {
  const blobPath = (id: string) => join(dir, id);

  return {
    async save({ bytes, contentType, alt }) {
      await mkdir(dir, { recursive: true });
      const id = ulid();
      await writeFile(blobPath(id), bytes);
      const [row] = await database.db
        .insert(media)
        .values({ id, contentType, alt: alt ?? null, byteSize: bytes.byteLength })
        .returning();
      if (row == null) throw new Error("Failed to insert media");
      return row;
    },

    async get(id) {
      const [row] = await database.db
        .select()
        .from(media)
        .where(eq(media.id, id))
        .limit(1);
      if (row == null) return null;
      try {
        return { row, bytes: await readFile(blobPath(id)) };
      } catch {
        return null;
      }
    },

    async remove(id) {
      await database.db.delete(media).where(eq(media.id, id));
      await rm(blobPath(id), { force: true });
    },

    async resolveAttachments(items) {
      const attachments: Attachment[] = [];
      for (const item of items) {
        const [row] = await database.db
          .select()
          .from(media)
          .where(eq(media.id, item.mediaId))
          .limit(1);
        if (row == null) continue;
        attachments.push({
          mediaId: row.id,
          contentType: row.contentType,
          alt: item.alt ?? row.alt,
        });
      }
      return attachments;
    },
  };
}
