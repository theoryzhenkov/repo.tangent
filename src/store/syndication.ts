import { and, eq } from "drizzle-orm";
import { ulid } from "ulid";
import type { Database } from "../db/client.ts";
import { syndication } from "../db/schema.ts";

export type SyndicationRow = typeof syndication.$inferSelect;

export async function getSyndication(
  database: Database,
  noteId: string,
  network: string,
): Promise<SyndicationRow | undefined> {
  const [row] = await database.db
    .select()
    .from(syndication)
    .where(and(eq(syndication.noteId, noteId), eq(syndication.network, network)))
    .limit(1);
  return row;
}

/** Record that a note was syndicated to another network. Idempotent per (note, network). */
export async function recordSyndication(
  database: Database,
  noteId: string,
  network: string,
  remoteUri: string,
  remoteCid: string | null,
): Promise<void> {
  await database.db
    .insert(syndication)
    .values({ id: ulid(), noteId, network, remoteUri, remoteCid })
    .onConflictDoNothing({ target: [syndication.noteId, syndication.network] });
}

/** Refresh the stored remote uri/cid after editing a syndicated copy in place. */
export async function updateSyndication(
  database: Database,
  noteId: string,
  network: string,
  remoteUri: string,
  remoteCid: string | null,
): Promise<void> {
  await database.db
    .update(syndication)
    .set({ remoteUri, remoteCid })
    .where(and(eq(syndication.noteId, noteId), eq(syndication.network, network)));
}
