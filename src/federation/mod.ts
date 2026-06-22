import { createFederation } from "@fedify/fedify";
import { Endpoints, Person } from "@fedify/fedify/vocab";
import { PostgresKvStore } from "@fedify/postgres/kv";
import { PostgresMessageQueue } from "@fedify/postgres/mq";
import type { Database } from "../db/client.ts";
import { loadActorKeyPairs } from "./keys.ts";

/** Context data shared with every Fedify dispatcher/listener. */
export interface FedContextData {
  database: Database;
}

export interface FederationDeps {
  database: Database;
  /** WebFinger host, e.g. "theor.net" — the domain in the fediverse handle. */
  handleHost: string;
  /** ActivityPub server origin, e.g. "https://ap.theor.net". */
  webOrigin: string;
  /** The single actor's WebFinger username / identifier, e.g. "theor". */
  actorHandle: string;
}

export function createTangentFederation(deps: FederationDeps) {
  const { database, handleHost, webOrigin, actorHandle } = deps;

  const kv = new PostgresKvStore(database.sql);
  const queue = new PostgresMessageQueue(database.sql);

  const federation = createFederation<FedContextData>({
    kv,
    queue,
    // Split-domain: handle is @theor@theor.net, but actor/collection URIs
    // live under https://ap.theor.net.
    origin: { handleHost, webOrigin },
  });

  // Register the inbox routes so the actor can advertise its inbox/sharedInbox
  // URIs. Activity handlers (Follow, replies, …) are wired in later milestones.
  federation.setInboxListeners("/users/{identifier}/inbox", "/inbox");

  federation
    .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
      if (identifier !== actorHandle) return null;
      const actorKeys = await ctx.getActorKeyPairs(identifier);
      return new Person({
        id: ctx.getActorUri(identifier),
        preferredUsername: identifier,
        name: actorHandle,
        url: new URL("/", `https://${handleHost}`),
        inbox: ctx.getInboxUri(identifier),
        endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
        publicKey: actorKeys[0]?.cryptographicKey,
        assertionMethods: actorKeys.map((key) => key.multikey),
      });
    })
    .setKeyPairsDispatcher(async (_ctx, identifier) => {
      if (identifier !== actorHandle) return [];
      return await loadActorKeyPairs(database);
    });

  return { federation, kv, queue };
}
