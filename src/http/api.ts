import { Hono } from "hono";
import type { Database } from "../db/client.ts";
import {
  countInteractions,
  type InboxObjectRow,
  listReplies,
} from "../store/inbox.ts";
import { getNote, listNotes, type NoteRow } from "../store/notes.ts";

export function serializeNote(row: NoteRow) {
  const origin = new URL(row.uri).origin;
  return {
    id: row.id,
    uri: row.uri,
    url: row.uri,
    html: row.html,
    text: row.text,
    inReplyTo: row.inReplyTo,
    tags: row.tags,
    attachments: row.attachments.map((attachment) => ({
      mediaId: attachment.mediaId,
      url: `${origin}/media/${attachment.mediaId}`,
      contentType: attachment.contentType,
      alt: attachment.alt,
    })),
    visibility: row.visibility,
    published: row.publishedAt.toISOString(),
    updated: row.updatedAt != null ? row.updatedAt.toISOString() : null,
  };
}

function serializeReply(row: InboxObjectRow) {
  const raw = (row.raw ?? {}) as {
    content?: string;
    published?: string | null;
    url?: string | null;
    attributedTo?: string;
  };
  return {
    id: row.uri,
    actor: raw.attributedTo ?? row.actorUri,
    content: raw.content ?? "",
    published: raw.published ?? row.receivedAt.toISOString(),
    url: raw.url ?? row.uri,
  };
}

/**
 * Purpose-built JSON read API consumed by the Home site. This replaces the
 * bespoke Ghost ActivityPub endpoints Home reads today.
 */
export function createNotesApi(database: Database): Hono {
  const api = new Hono();

  api.get("/notes", async (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? "50") || 50, 100);
    const cursor = c.req.query("cursor") ?? "";
    const page = await listNotes(database, { cursor, limit });
    return c.json({
      notes: page.items.map(serializeNote),
      nextCursor: page.nextCursor,
    });
  });

  api.get("/notes/:id/thread", async (c) => {
    const id = c.req.param("id");
    const row = await getNote(database, id);
    if (row == null) return c.json({ error: "not found" }, 404);
    const [replies, likes, announces] = await Promise.all([
      listReplies(database, id),
      countInteractions(database, id, "like"),
      countInteractions(database, id, "announce"),
    ]);
    return c.json({
      note: serializeNote(row),
      ancestors: [],
      replies: replies.map(serializeReply),
      likes,
      announces,
    });
  });

  return api;
}
