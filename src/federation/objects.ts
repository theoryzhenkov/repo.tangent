import type { Context } from "@fedify/fedify";
import { Create, Note } from "@fedify/fedify/vocab";
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
  return new Note({
    id: ctx.getObjectUri(Note, { identifier, noteId: row.id }),
    attribution: ctx.getActorUri(identifier),
    content: row.html,
    published: toInstant(row.publishedAt),
    to: PUBLIC_URI,
    cc: ctx.getFollowersUri(identifier),
    replyTarget: row.inReplyTo != null ? new URL(row.inReplyTo) : null,
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
