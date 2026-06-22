import { ulid } from "ulid";
import type { Database } from "../db/client.ts";
import { syndication } from "../db/schema.ts";

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
