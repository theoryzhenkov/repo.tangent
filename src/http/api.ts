import { Hono } from "hono";
import type { Database } from "../db/client.ts";
import { getNote, listNotes, type NoteRow } from "../store/notes.ts";

function serializeNote(row: NoteRow) {
  return {
    id: row.id,
    uri: row.uri,
    url: row.uri,
    html: row.html,
    text: row.text,
    inReplyTo: row.inReplyTo,
    tags: row.tags,
    visibility: row.visibility,
    published: row.publishedAt.toISOString(),
    updated: row.updatedAt != null ? row.updatedAt.toISOString() : null,
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
    const row = await getNote(database, c.req.param("id"));
    if (row == null) return c.json({ error: "not found" }, 404);
    // Ancestors/replies are filled from inbox activities in a later milestone.
    return c.json({ note: serializeNote(row), ancestors: [], replies: [] });
  });

  return api;
}
