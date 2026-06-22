import { eq, sql } from "drizzle-orm";
import type { Database } from "../db/client.ts";
import { actors, followers } from "../db/schema.ts";

export interface FollowerRecipient {
  actorUri: string;
  inboxUrl: string;
  sharedInboxUrl: string | null;
}

export interface RemoteActorInput {
  uri: string;
  handle?: string | null;
  name?: string | null;
  inboxUrl: string;
  sharedInboxUrl?: string | null;
  raw?: unknown;
}

export async function upsertActor(
  database: Database,
  actor: RemoteActorInput,
): Promise<void> {
  const values = {
    uri: actor.uri,
    handle: actor.handle ?? null,
    name: actor.name ?? null,
    inboxUrl: actor.inboxUrl,
    sharedInboxUrl: actor.sharedInboxUrl ?? null,
    raw: actor.raw ?? null,
  };
  await database.db
    .insert(actors)
    .values(values)
    .onConflictDoUpdate({
      target: actors.uri,
      set: { ...values, fetchedAt: new Date() },
    });
}

export async function addFollower(
  database: Database,
  actor: RemoteActorInput,
): Promise<void> {
  await upsertActor(database, actor);
  await database.db
    .insert(followers)
    .values({ actorUri: actor.uri })
    .onConflictDoNothing();
}

export async function removeFollower(
  database: Database,
  actorUri: string,
): Promise<void> {
  await database.db.delete(followers).where(eq(followers.actorUri, actorUri));
}

export async function listFollowers(
  database: Database,
): Promise<FollowerRecipient[]> {
  return await database.db
    .select({
      actorUri: actors.uri,
      inboxUrl: actors.inboxUrl,
      sharedInboxUrl: actors.sharedInboxUrl,
    })
    .from(followers)
    .innerJoin(actors, eq(followers.actorUri, actors.uri));
}

export async function countFollowers(database: Database): Promise<number> {
  const [row] = await database.db
    .select({ count: sql<number>`count(*)::int` })
    .from(followers);
  return row?.count ?? 0;
}
