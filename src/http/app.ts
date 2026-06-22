import { federation as fedifyMiddleware } from "@fedify/hono";
import type { Federation } from "@fedify/fedify";
import { Hono } from "hono";
import type { Database } from "../db/client.ts";
import type { FedContextData } from "../federation/mod.ts";

export interface AppDeps {
  database: Database;
  federation: Federation<FedContextData>;
}

export function createApp({ database, federation }: AppDeps): Hono {
  const app = new Hono();

  // Fedify intercepts ActivityPub/WebFinger requests via content negotiation
  // and falls through to the routes below for everything else.
  app.use(fedifyMiddleware(federation, () => ({ database })));

  // Liveness: process is up. Must not depend on external services.
  app.get("/healthz", (c) => c.json({ status: "ok" }));

  // Readiness: dependencies (Postgres) are reachable.
  app.get("/readyz", async (c) => {
    try {
      await database.sql`select 1`;
      return c.json({ status: "ready" });
    } catch (error) {
      return c.json(
        { status: "unavailable", error: String(error) },
        503,
      );
    }
  });

  return app;
}
