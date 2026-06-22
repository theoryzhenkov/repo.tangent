import type { Context } from "@fedify/fedify";
import { Create, Delete, Image, Note, Tombstone, Update } from "@fedify/fedify/vocab";
import "../temporal.ts";
import type { NoteRow } from "../store/notes.ts";
import type { FedContextData } from "./mod.ts";

const PUBLIC_URI = new URL("https://www.w3.org/ns/activitystreams#Public");

function toInstant(date: Date): Temporal.Instant {
  return Temporal.Instant.from(date.toISOString());
}

/** Map a stored note to its ActivityStreams `Note` object. */
export function toNoteObject(
  ctx: Context<FedContextData>,
  identifier: string,
  row: NoteRow,
): Note {
  const origin = new URL(row.uri).origin;
  const attachments = row.attachments.map(
    (attachment) =>
      new Image({
        mediaType: attachment.contentType,
        url: new URL(`/media/${attachment.mediaId}`, origin),
        name: attachment.alt ?? undefined,
      }),
  );

  return new Note({
    id: ctx.getObjectUri(Note, { identifier, noteId: row.id }),
    attribution: ctx.getActorUri(identifier),
    content: row.html,
    published: toInstant(row.publishedAt),
    updated: row.updatedAt != null ? toInstant(row.updatedAt) : null,
    to: PUBLIC_URI,
    cc: ctx.getFollowersUri(identifier),
    replyTarget: row.inReplyTo != null ? new URL(row.inReplyTo) : null,
    attachments,
    url: new URL(row.uri),
  });
}

/** Wrap a stored note in the `Create` activity used in the outbox and delivery. */
export function toCreateActivity(
  ctx: Context<FedContextData>,
  identifier: string,
  row: NoteRow,
): Create {
  return new Create({
    id: new URL(`${row.uri}#create`),
    actor: ctx.getActorUri(identifier),
    object: toNoteObject(ctx, identifier, row),
    published: toInstant(row.publishedAt),
    to: PUBLIC_URI,
    cc: ctx.getFollowersUri(identifier),
  });
}

/** Build the `Update` activity delivered to followers when a note is edited. */
export function toUpdateActivity(
  ctx: Context<FedContextData>,
  identifier: string,
  row: NoteRow,
): Update {
  const revision = (row.updatedAt ?? new Date()).getTime();
  return new Update({
    id: new URL(`${row.uri}#update-${revision}`),
    actor: ctx.getActorUri(identifier),
    object: toNoteObject(ctx, identifier, row),
    to: PUBLIC_URI,
    cc: ctx.getFollowersUri(identifier),
  });
}

/** Build the `Delete` (Tombstone) activity delivered to followers on deletion. */
export function toDeleteActivity(
  ctx: Context<FedContextData>,
  identifier: string,
  row: NoteRow,
): Delete {
  return new Delete({
    id: new URL(`${row.uri}#delete`),
    actor: ctx.getActorUri(identifier),
    object: new Tombstone({ id: new URL(row.uri) }),
    to: PUBLIC_URI,
    cc: ctx.getFollowersUri(identifier),
  });
}
