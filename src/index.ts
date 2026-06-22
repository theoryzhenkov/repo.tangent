import { behindProxy } from "x-forwarded-fetch";
import { loadConfig } from "./config.ts";
import { createDatabase } from "./db/client.ts";
import { ensureActorKeys } from "./federation/keys.ts";
import { createTangentFederation } from "./federation/mod.ts";
import { createApp } from "./http/app.ts";

const config = loadConfig();
const database = createDatabase(config.databaseUrl);

const { federation, kv, queue } = createTangentFederation({
  database,
  handleHost: config.handleHost,
  webOrigin: config.apOrigin,
  actorHandle: config.actorHandle,
});

// Ensure Fedify's cache/queue tables and the actor keypairs exist.
await kv.initialize();
await queue.initialize();
await ensureActorKeys(database);

const app = createApp({ database, federation, config });

console.log(`tangent listening on :${config.port}`);

// `behindProxy` reconstructs the request URL from X-Forwarded-* headers so that
// Fedify builds collection/page links with the public origin. The service is
// only reachable through the nginx reverse proxy in production.
export default {
  port: config.port,
  fetch: behindProxy(app.fetch),
};
