function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

export interface Config {
  port: number;
  databaseUrl: string;
  handleHost: string;
  apOrigin: string;
  actorHandle: string;
  /** Bearer token required by the compose endpoint; compose is disabled if null. */
  composeToken: string | null;
}

export function loadConfig(): Config {
  return {
    port: Number(optional("PORT", "8787")),
    databaseUrl: required("DATABASE_URL"),
    handleHost: optional("HANDLE_HOST", "theor.net"),
    apOrigin: optional("AP_ORIGIN", "https://ap.theor.net"),
    actorHandle: optional("ACTOR_HANDLE", "theor"),
    composeToken: process.env.COMPOSE_TOKEN?.trim() || null,
  };
}
