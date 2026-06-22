import { Hono } from "hono";
import type { Database } from "../db/client.ts";

export interface AppDeps {
  database: Database;
}

export function createApp({ database }: AppDeps): Hono {
  const app = new Hono();

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
