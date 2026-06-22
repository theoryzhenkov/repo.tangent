import { migrate } from "drizzle-orm/postgres-js/migrator";
import { loadConfig } from "./config.ts";
import { createDatabase } from "./db/client.ts";

// Apply pending Drizzle migrations at runtime using drizzle-orm (no drizzle-kit
// dependency needed). Run before starting the server in the container.
const config = loadConfig();
const { db, sql } = createDatabase(config.databaseUrl);

await migrate(db, { migrationsFolder: "./drizzle" });
await sql.end();

console.log("tangent: migrations applied");
