import type { Federation } from "@fedify/fedify";
import { federation as fedifyMiddleware } from "@fedify/hono";
import { Hono } from "hono";
import type { Config } from "../config.ts";
import type { Database } from "../db/client.ts";
import type { FedContextData } from "../federation/mod.ts";
import { toCreateActivity } from "../federation/objects.ts";
import { renderNote } from "../notes/render.ts";
import { createNote } from "../store/notes.ts";
import { createNotesApi } from "./api.ts";

export interface AppDeps {
  database: Database;
  federation: Federation<FedContextData>;
  config: Config;
}

export function createApp({ database, federation, config }: AppDeps): Hono {
  const app = new Hono();

  // Fedify intercepts ActivityPub/WebFinger requests via content negotiation
  // and falls through to the routes below for everything else.
  app.use(fedifyMiddleware(federation, () => ({ database })));

  // JSON read API for the Home site.
  app.route("/api", createNotesApi(database));

  // Authenticated compose endpoint used by the CLI: create a note and deliver
  // a Create(Note) activity to followers.
  app.post("/api/compose", async (c) => {
    if (config.composeToken == null) {
      return c.json({ error: "compose disabled" }, 503);
    }
    if (c.req.header("authorization") !== `Bearer ${config.composeToken}`) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const body = (await c.req.json().catch(() => null)) as {
      text?: unknown;
      inReplyTo?: unknown;
    } | null;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (text === "") {
      return c.json({ error: "text required" }, 400);
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
    });

    const ctx = federation.createContext(new URL(config.apOrigin), { database });
    await ctx.sendActivity(
      { identifier: config.actorHandle },
      "followers",
      toCreateActivity(ctx, config.actorHandle, note),
    );

    return c.json({ id: note.id, uri: note.uri, tags });
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
