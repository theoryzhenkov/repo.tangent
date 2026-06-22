import { createFederation } from "@fedify/fedify";
import {
  Accept,
  Announce,
  Create,
  Delete,
  Endpoints,
  Follow,
  Like,
  Note,
  Person,
  type Recipient,
  Undo,
} from "@fedify/fedify/vocab";
import { PostgresKvStore } from "@fedify/postgres/kv";
import { PostgresMessageQueue } from "@fedify/postgres/mq";
import type { Database } from "../db/client.ts";
import {
  addFollower,
  countFollowers,
  listFollowers,
  removeFollower,
} from "../store/followers.ts";
import {
  deleteInboxObjectByUri,
  recordInboxObject,
} from "../store/inbox.ts";
import {
  countNotes,
  getNote,
  listNotes,
  localNoteId,
} from "../store/notes.ts";
import { loadActorKeyPairs } from "./keys.ts";
import { toCreateActivity, toNoteObject } from "./objects.ts";

const OUTBOX_WINDOW = 20;

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
    // Split-domain: handle is @theor@theor.net, actor/collection URIs live
    // under https://ap.theor.net.
    origin: { handleHost, webOrigin },
  });

  federation
    .setInboxListeners("/users/{identifier}/inbox", "/inbox")
    .on(Follow, async (ctx, follow) => {
      if (follow.objectId == null || follow.actorId == null) return;
      const target = ctx.parseUri(follow.objectId);
      if (target?.type !== "actor" || target.identifier !== actorHandle) return;

      const follower = await follow.getActor(ctx);
      if (follower?.id == null || follower.inboxId == null) return;

      await addFollower(database, {
        uri: follower.id.href,
        handle: follower.preferredUsername?.toString() ?? null,
        name: follower.name?.toString() ?? null,
        inboxUrl: follower.inboxId.href,
        sharedInboxUrl: follower.endpoints?.sharedInbox?.href ?? null,
      });

      await ctx.sendActivity(
        { identifier: actorHandle },
        follower,
        new Accept({ actor: follow.objectId, object: follow }),
      );
      console.info(`tangent: accepted follow from ${follower.id.href}`);
    })
    .on(Undo, async (ctx, undo) => {
      const object = await undo.getObject(ctx);
      if (!(object instanceof Follow)) return;
      if (object.objectId == null || undo.actorId == null) return;
      const target = ctx.parseUri(object.objectId);
      if (target?.type !== "actor" || target.identifier !== actorHandle) return;

      await removeFollower(database, undo.actorId.href);
      console.info(`tangent: removed follower ${undo.actorId.href}`);
    })
    .on(Create, async (ctx, create) => {
      const object = await create.getObject(ctx);
      if (!(object instanceof Note) || object.id == null || create.actorId == null) {
        return;
      }
      const targetNoteId = localNoteId(
        webOrigin,
        actorHandle,
        object.replyTargetId?.href,
      );
      if (targetNoteId == null) return; // only keep replies to our notes
      await recordInboxObject(database, {
        uri: object.id.href,
        type: "reply",
        actorUri: create.actorId.href,
        targetNoteId,
        raw: {
          content: object.content?.toString() ?? "",
          published: object.published?.toString() ?? null,
          url: object.url instanceof URL ? object.url.href : null,
          attributedTo: create.actorId.href,
        },
      });
    })
    .on(Like, async (_ctx, like) => {
      if (like.objectId == null || like.actorId == null) return;
      const targetNoteId = localNoteId(webOrigin, actorHandle, like.objectId.href);
      if (targetNoteId == null) return;
      await recordInboxObject(database, {
        uri: like.id?.href ?? `${like.actorId.href}#like-${targetNoteId}`,
        type: "like",
        actorUri: like.actorId.href,
        targetNoteId,
      });
    })
    .on(Announce, async (_ctx, announce) => {
      if (announce.objectId == null || announce.actorId == null) return;
      const targetNoteId = localNoteId(
        webOrigin,
        actorHandle,
        announce.objectId.href,
      );
      if (targetNoteId == null) return;
      await recordInboxObject(database, {
        uri: announce.id?.href ?? `${announce.actorId.href}#announce-${targetNoteId}`,
        type: "announce",
        actorUri: announce.actorId.href,
        targetNoteId,
      });
    })
    .on(Delete, async (_ctx, del) => {
      if (del.objectId == null) return;
      await deleteInboxObjectByUri(database, del.objectId.href);
      // A remote actor deleting itself unfollows us.
      if (del.actorId != null && del.objectId.href === del.actorId.href) {
        await removeFollower(database, del.actorId.href);
      }
    })
    .onError(async (_ctx, error) => {
      console.error("tangent: inbox listener error", error);
    });

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
        outbox: ctx.getOutboxUri(identifier),
        followers: ctx.getFollowersUri(identifier),
        endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
        publicKey: actorKeys[0]?.cryptographicKey,
        assertionMethods: actorKeys.map((key) => key.multikey),
      });
    })
    .setKeyPairsDispatcher(async (_ctx, identifier) =>
      identifier === actorHandle ? await loadActorKeyPairs(database) : [],
    );

  // Individual notes must be dereferenceable by their URIs.
  federation.setObjectDispatcher(
    Note,
    "/users/{identifier}/notes/{noteId}",
    async (ctx, { identifier, noteId }) => {
      if (identifier !== actorHandle) return null;
      const row = await getNote(database, noteId);
      if (row == null) return null;
      return toNoteObject(ctx, identifier, row);
    },
  );

  federation
    .setOutboxDispatcher(
      "/users/{identifier}/outbox",
      async (ctx, identifier, cursor) => {
        if (identifier !== actorHandle || cursor == null) return null;
        const page = await listNotes(database, {
          cursor,
          limit: OUTBOX_WINDOW,
        });
        return {
          items: page.items.map((row) => toCreateActivity(ctx, identifier, row)),
          nextCursor: page.nextCursor,
        };
      },
    )
    .setFirstCursor(async (_ctx, identifier) =>
      identifier === actorHandle ? "" : null,
    )
    .setCounter(async (_ctx, identifier) =>
      identifier === actorHandle ? await countNotes(database) : 0,
    );

  federation
    .setFollowersDispatcher(
      "/users/{identifier}/followers",
      // Returns the entire collection in one shot (cursor ignored) so
      // sendActivity(..., "followers", ...) can gather every recipient.
      async (_ctx, identifier) => {
        if (identifier !== actorHandle) return null;
        const rows = await listFollowers(database);
        const items: Recipient[] = rows.map((row) => ({
          id: new URL(row.actorUri),
          inboxId: new URL(row.inboxUrl),
          endpoints:
            row.sharedInboxUrl != null
              ? { sharedInbox: new URL(row.sharedInboxUrl) }
              : null,
        }));
        return { items };
      },
    )
    .setFirstCursor(async (_ctx, identifier) =>
      identifier === actorHandle ? "" : null,
    )
    .setCounter(async (_ctx, identifier) =>
      identifier === actorHandle ? await countFollowers(database) : 0,
    );

  return { federation, kv, queue };
}
