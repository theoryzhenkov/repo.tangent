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

const app = createApp({ database, federation });

console.log(`tangent listening on :${config.port}`);

export default {
  port: config.port,
  fetch: app.fetch,
};
