import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { Config } from "../config.ts";

export const SESSION_COOKIE = "tangent_session";

/** Derive a stable session token from the admin password (single-user). */
export function sessionToken(adminPassword: string): string {
  return createHmac("sha256", adminPassword)
    .update("tangent-admin-session")
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Constant-time check of a submitted admin password. */
export function checkPassword(input: string, password: string): boolean {
  return safeEqual(input, password);
}

/** Authorized via either the CLI bearer token or a valid admin session cookie. */
export function isAuthed(c: Context, config: Config): boolean {
  const bearer = c.req.header("authorization");
  if (config.composeToken != null && bearer === `Bearer ${config.composeToken}`) {
    return true;
  }
  if (config.adminPassword != null) {
    const cookie = getCookie(c, SESSION_COOKIE);
    if (cookie != null && safeEqual(cookie, sessionToken(config.adminPassword))) {
      return true;
    }
  }
  return false;
}
