import { and, eq, sql } from "drizzle-orm";
import { ulid } from "ulid";
import type { Database } from "../db/client.ts";
import { inboxObjects } from "../db/schema.ts";

export type InboxObjectRow = typeof inboxObjects.$inferSelect;

export interface InboxObjectInput {
  uri: string;
  type: "reply" | "like" | "announce";
  actorUri: string;
  targetNoteId: string;
  raw?: unknown;
}

/** Record an inbound interaction (reply/like/boost) against a local note. Idempotent by uri. */
export async function recordInboxObject(
  database: Database,
  input: InboxObjectInput,
): Promise<void> {
  await database.db
    .insert(inboxObjects)
    .values({
      id: ulid(),
      uri: input.uri,
      type: input.type,
      actorUri: input.actorUri,
      targetNoteId: input.targetNoteId,
      raw: input.raw ?? null,
    })
    .onConflictDoNothing({ target: inboxObjects.uri });
}

export async function deleteInboxObjectByUri(
  database: Database,
  uri: string,
): Promise<void> {
  await database.db.delete(inboxObjects).where(eq(inboxObjects.uri, uri));
}

export async function listReplies(
  database: Database,
  targetNoteId: string,
): Promise<InboxObjectRow[]> {
  return await database.db
    .select()
    .from(inboxObjects)
    .where(
      and(
        eq(inboxObjects.targetNoteId, targetNoteId),
        eq(inboxObjects.type, "reply"),
      ),
    )
    .orderBy(inboxObjects.receivedAt);
}

export async function countInteractions(
  database: Database,
  targetNoteId: string,
  type: "like" | "announce",
): Promise<number> {
  const [row] = await database.db
    .select({ count: sql<number>`count(*)::int` })
    .from(inboxObjects)
    .where(
      and(
        eq(inboxObjects.targetNoteId, targetNoteId),
        eq(inboxObjects.type, type),
      ),
    );
  return row?.count ?? 0;
}
