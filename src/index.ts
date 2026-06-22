import { loadConfig } from "./config.ts";
import { createDatabase } from "./db/client.ts";
import { createApp } from "./http/app.ts";

const config = loadConfig();
const database = createDatabase(config.databaseUrl);
const app = createApp({ database });

console.log(`tangent listening on :${config.port}`);

export default {
  port: config.port,
  fetch: app.fetch,
};
