import { desc, eq, lt, sql } from "drizzle-orm";
import { ulid } from "ulid";
import type { Database } from "../db/client.ts";
import { notes } from "../db/schema.ts";

export type NoteRow = typeof notes.$inferSelect;

export interface CreateNoteInput {
  text: string;
  html: string;
  inReplyTo?: string | null;
  tags?: string[];
  visibility?: string;
}

export function buildNoteUri(
  apOrigin: string,
  actorHandle: string,
  id: string,
): string {
  return `${apOrigin}/users/${actorHandle}/notes/${id}`;
}

/** Return the local note id if `uri` addresses one of our notes, else null. */
export function localNoteId(
  apOrigin: string,
  actorHandle: string,
  uri: string | null | undefined,
): string | null {
  if (uri == null) return null;
  const prefix = `${apOrigin}/users/${actorHandle}/notes/`;
  return uri.startsWith(prefix) ? uri.slice(prefix.length) : null;
}

export async function createNote(
  database: Database,
  apOrigin: string,
  actorHandle: string,
  input: CreateNoteInput,
): Promise<NoteRow> {
  const id = ulid();
  const [row] = await database.db
    .insert(notes)
    .values({
      id,
      uri: buildNoteUri(apOrigin, actorHandle, id),
      text: input.text,
      html: input.html,
      inReplyTo: input.inReplyTo ?? null,
      tags: input.tags ?? [],
      visibility: input.visibility ?? "public",
    })
    .returning();
  if (row == null) throw new Error("Failed to insert note");
  return row;
}

export async function getNote(
  database: Database,
  id: string,
): Promise<NoteRow | undefined> {
  const [row] = await database.db
    .select()
    .from(notes)
    .where(eq(notes.id, id))
    .limit(1);
  return row;
}

export interface NotePage {
  items: NoteRow[];
  nextCursor: string | null;
}

/** List notes newest-first. Cursor is the id of the last item of the prior page. */
export async function listNotes(
  database: Database,
  options: { cursor?: string | null; limit: number },
): Promise<NotePage> {
  const condition =
    options.cursor != null && options.cursor !== ""
      ? lt(notes.id, options.cursor)
      : undefined;
  const rows = await database.db
    .select()
    .from(notes)
    .where(condition)
    .orderBy(desc(notes.id))
    .limit(options.limit + 1);

  const hasMore = rows.length > options.limit;
  const items = hasMore ? rows.slice(0, options.limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last != null ? last.id : null };
}

export async function countNotes(database: Database): Promise<number> {
  const [row] = await database.db
    .select({ count: sql<number>`count(*)::int` })
    .from(notes);
  return row?.count ?? 0;
}
