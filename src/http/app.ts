import type { Federation } from "@fedify/fedify";
import { federation as fedifyMiddleware } from "@fedify/hono";
import { type Context, Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import {
  type BlueskyClient,
  type BlueskyImage,
  buildBlueskyText,
} from "../bluesky/client.ts";
import type { Config } from "../config.ts";
import type { Database } from "../db/client.ts";
import type { Attachment } from "../db/schema.ts";
import type { FedContextData } from "../federation/mod.ts";
import {
  toCreateActivity,
  toDeleteActivity,
  toUpdateActivity,
} from "../federation/objects.ts";
import { renderNote } from "../notes/render.ts";
import type { MediaStore } from "../store/media.ts";
import { createNote, deleteNote, getNote, updateNote } from "../store/notes.ts";
import { getSyndication, recordSyndication } from "../store/syndication.ts";
import { adminPage, loginPage } from "./admin.ts";
import { createNotesApi, serializeNote } from "./api.ts";
import { checkPassword, isAuthed, SESSION_COOKIE, sessionToken } from "./auth.ts";
import { publicNotePage } from "./public.ts";

export interface AppDeps {
  database: Database;
  federation: Federation<FedContextData>;
  config: Config;
  bluesky: BlueskyClient | null;
  mediaStore: MediaStore;
}

interface AttachmentRef {
  mediaId: string;
  alt: string | null;
}

function parseAttachmentRefs(value: unknown): AttachmentRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      item != null &&
      typeof item === "object" &&
      typeof (item as { mediaId?: unknown }).mediaId === "string"
    ) {
      const alt = (item as { alt?: unknown }).alt;
      return [
        {
          mediaId: (item as { mediaId: string }).mediaId,
          alt: typeof alt === "string" ? alt : null,
        },
      ];
    }
    return [];
  });
}

export function createApp({
  database,
  federation,
  config,
  bluesky,
  mediaStore,
}: AppDeps): Hono {
  const app = new Hono();

  const auth = (c: Context) => isAuthed(c, config);

  async function blueskyImages(
    attachments: Attachment[],
  ): Promise<BlueskyImage[]> {
    const images: BlueskyImage[] = [];
    for (const attachment of attachments) {
      if (!attachment.contentType.startsWith("image/")) continue;
      const blob = await mediaStore.get(attachment.mediaId);
      if (blob == null) continue;
      images.push({
        bytes: blob.bytes,
        contentType: attachment.contentType,
        alt: attachment.alt,
      });
    }
    return images;
  }

  async function pruneRemovedMedia(
    before: Attachment[],
    after: Attachment[],
  ): Promise<void> {
    const keep = new Set(after.map((a) => a.mediaId));
    for (const attachment of before) {
      if (!keep.has(attachment.mediaId)) await mediaStore.remove(attachment.mediaId);
    }
  }

  // Fedify intercepts ActivityPub/WebFinger requests via content negotiation
  // and falls through to the routes below for everything else.
  app.use(fedifyMiddleware(federation, () => ({ database })));

  // JSON read API for the Home site.
  app.route("/api", createNotesApi(database));

  // Public media blobs.
  app.get("/media/:id", async (c) => {
    const blob = await mediaStore.get(c.req.param("id"));
    if (blob == null) return c.text("not found", 404);
    return new Response(blob.bytes, {
      status: 200,
      headers: {
        "content-type": blob.row.contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  });

  // Public browser permalink used by POSSE links.
  app.get("/notes/:id", async (c) => {
    const note = await getNote(database, c.req.param("id"));
    if (note == null) return c.text("not found", 404);
    return c.html(
      publicNotePage(
        note,
        config.notePermalinkBase ?? `${config.apOrigin}/notes`,
        config.apOrigin,
      ),
    );
  });

  // Upload an image, returning its id + url for use as an attachment.
  app.post("/api/media", async (c) => {
    if (!auth(c)) return c.json({ error: "unauthorized" }, 401);
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return c.json({ error: "file required" }, 400);
    if (!file.type.startsWith("image/")) {
      return c.json({ error: "only images are supported" }, 415);
    }
    const altValue = form.get("alt");
    const row = await mediaStore.save({
      bytes: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
      alt: typeof altValue === "string" && altValue !== "" ? altValue : null,
    });
    return c.json({
      id: row.id,
      url: `${config.apOrigin}/media/${row.id}`,
      contentType: row.contentType,
      alt: row.alt,
    });
  });

  // Create a note, deliver Create(Note) to followers, and POSSE to Bluesky.
  app.post("/api/compose", async (c) => {
    if (!auth(c)) return c.json({ error: "unauthorized" }, 401);
    const body = (await c.req.json().catch(() => null)) as {
      text?: unknown;
      inReplyTo?: unknown;
      attachments?: unknown;
    } | null;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const attachments = await mediaStore.resolveAttachments(
      parseAttachmentRefs(body?.attachments),
    );
    if (text === "" && attachments.length === 0) {
      return c.json({ error: "text or attachment required" }, 400);
    }
    const inReplyTo =
      typeof body?.inReplyTo === "string" && body.inReplyTo !== ""
        ? body.inReplyTo
        : null;

    const { html, tags } = renderNote(text);
    const note = await createNote(database, config.apOrigin, config.actorHandle, {
      text,
      html,
      inReplyTo,
      tags,
      attachments,
    });

    const ctx = federation.createContext(new URL(config.apOrigin), { database });
    await ctx.sendActivity(
      { identifier: config.actorHandle },
      "followers",
      toCreateActivity(ctx, config.actorHandle, note),
    );

    let syndicated: { bluesky: string } | null = null;
    if (bluesky != null && note.inReplyTo == null) {
      try {
        const permalink =
          config.notePermalinkBase != null
            ? `${config.notePermalinkBase.replace(/\/$/, "")}/${note.id}`
            : null;
        const result = await bluesky.post({
          text: buildBlueskyText(note.text, permalink),
          images: await blueskyImages(attachments),
        });
        await recordSyndication(database, note.id, "bluesky", result.uri, result.cid);
        syndicated = { bluesky: result.uri };
      } catch (error) {
        console.error("tangent: bluesky syndication failed", error);
      }
    }

    return c.json({ note: serializeNote(note), syndicated });
  });

  // Edit a note and deliver Update(Note). The Bluesky copy is left unchanged.
  app.patch("/api/notes/:id", async (c) => {
    if (!auth(c)) return c.json({ error: "unauthorized" }, 401);
    const id = c.req.param("id");
    const existing = await getNote(database, id);
    if (existing == null) return c.json({ error: "not found" }, 404);

    const body = (await c.req.json().catch(() => null)) as {
      text?: unknown;
      attachments?: unknown;
    } | null;
    const text = typeof body?.text === "string" ? body.text.trim() : existing.text;
    const refs =
      body?.attachments !== undefined
        ? parseAttachmentRefs(body.attachments)
        : existing.attachments.map((a) => ({ mediaId: a.mediaId, alt: a.alt }));
    const attachments = await mediaStore.resolveAttachments(refs);

    const { html, tags } = renderNote(text);
    const note = await updateNote(database, id, { text, html, tags, attachments });
    if (note == null) return c.json({ error: "not found" }, 404);

    const ctx = federation.createContext(new URL(config.apOrigin), { database });
    await ctx.sendActivity(
      { identifier: config.actorHandle },
      "followers",
      toUpdateActivity(ctx, config.actorHandle, note),
    );
    await pruneRemovedMedia(existing.attachments, attachments);

    return c.json({ note: serializeNote(note) });
  });

  // Delete a note: tombstone to followers, remove the Bluesky copy + blobs.
  app.delete("/api/notes/:id", async (c) => {
    if (!auth(c)) return c.json({ error: "unauthorized" }, 401);
    const id = c.req.param("id");
    const existing = await getNote(database, id);
    if (existing == null) return c.json({ error: "not found" }, 404);

    const ctx = federation.createContext(new URL(config.apOrigin), { database });
    await ctx.sendActivity(
      { identifier: config.actorHandle },
      "followers",
      toDeleteActivity(ctx, config.actorHandle, existing),
    );

    if (bluesky != null) {
      const synd = await getSyndication(database, id, "bluesky");
      if (synd != null) {
        try {
          await bluesky.deletePost(synd.remoteUri);
        } catch (error) {
          console.error("tangent: bluesky delete failed", error);
        }
      }
    }

    await deleteNote(database, id); // cascades syndication + inbox_objects
    for (const attachment of existing.attachments) {
      await mediaStore.remove(attachment.mediaId);
    }
    return c.json({ ok: true });
  });

  // Admin web UI (keyboard-driven composer/manager).
  app.get("/admin", (c) => {
    if (config.adminPassword == null) return c.text("admin disabled", 404);
    if (!auth(c)) return c.redirect("/admin/login");
    return c.html(
      adminPage(config.actorHandle, config.handleHost, config.notePermalinkBase),
    );
  });

  app.get("/admin/login", (c) =>
    config.adminPassword == null
      ? c.text("admin disabled", 404)
      : c.html(loginPage()),
  );

  app.post("/admin/login", async (c) => {
    if (config.adminPassword == null) return c.text("admin disabled", 404);
    const form = await c.req.formData();
    const password = form.get("password");
    if (
      typeof password === "string" &&
      checkPassword(password, config.adminPassword)
    ) {
      setCookie(c, SESSION_COOKIE, sessionToken(config.adminPassword), {
        httpOnly: true,
        secure: new URL(c.req.url).protocol === "https:",
        sameSite: "Lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return c.redirect("/admin");
    }
    return c.html(loginPage("Incorrect password"), 401);
  });

  app.post("/admin/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.redirect("/admin/login");
  });

  // Liveness: process is up. Must not depend on external services.
  app.get("/healthz", (c) => c.json({ status: "ok" }));

  // Readiness: dependencies (Postgres) are reachable.
  app.get("/readyz", async (c) => {
    try {
      await database.sql`select 1`;
      return c.json({ status: "ready" });
    } catch (error) {
      return c.json({ status: "unavailable", error: String(error) }, 503);
    }
  });

  return app;
}
