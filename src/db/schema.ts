import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * JSON Web Key shape, declared structurally so we don't pull the DOM lib into a
 * server build just for the global `JsonWebKey` type. Structurally identical to
 * WebCrypto's `JsonWebKey`, so it stays assignable to/from Fedify's JWK APIs.
 */
export interface Jwk {
  kty?: string;
  use?: string;
  key_ops?: string[];
  alg?: string;
  ext?: boolean;
  crv?: string;
  x?: string;
  y?: string;
  d?: string;
  n?: string;
  e?: string;
  p?: string;
  q?: string;
  dp?: string;
  dq?: string;
  qi?: string;
  k?: string;
  oth?: { r?: string; d?: string; t?: string }[];
}

/**
 * Local notes authored here. These are the only content that federates
 * (to the fediverse via Fedify and to Bluesky via POSSE). Pages live in the
 * Home repo as MDX and never federate.
 */
export const notes = pgTable(
  "notes",
  {
    id: text("id").primaryKey(), // ULID
    uri: text("uri").notNull(), // canonical ActivityPub id, derived from AP_ORIGIN
    html: text("html").notNull(),
    text: text("text").notNull(),
    inReplyTo: text("in_reply_to"), // AP id of the object this replies to, if any
    visibility: text("visibility").notNull().default("public"),
    tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("notes_uri_idx").on(t.uri)],
);

/** Cached remote actors we have seen (followers, repliers, likers). */
export const actors = pgTable("actors", {
  uri: text("uri").primaryKey(),
  handle: text("handle"),
  name: text("name"),
  inboxUrl: text("inbox_url").notNull(),
  sharedInboxUrl: text("shared_inbox_url"),
  raw: jsonb("raw"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Accounts that follow our actor. */
export const followers = pgTable("followers", {
  actorUri: text("actor_uri")
    .primaryKey()
    .references(() => actors.uri, { onDelete: "cascade" }),
  since: timestamp("since", { withTimezone: true }).notNull().defaultNow(),
});

/** Inbound objects that reference our notes: replies, likes, boosts. */
export const inboxObjects = pgTable(
  "inbox_objects",
  {
    id: text("id").primaryKey(), // ULID
    uri: text("uri").notNull(),
    type: text("type").notNull(), // Note(reply) | Like | Announce
    actorUri: text("actor_uri").notNull(),
    targetNoteId: text("target_note_id").references(() => notes.id, {
      onDelete: "cascade",
    }),
    raw: jsonb("raw"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("inbox_objects_uri_idx").on(t.uri),
    index("inbox_objects_target_idx").on(t.targetNoteId),
  ],
);

/** Our actor signing keypairs (RSA-PKCS#1-v1.5 and Ed25519), stored as JWK. */
export const keys = pgTable("keys", {
  type: text("type").primaryKey(), // "rsa" | "ed25519"
  privateJwk: jsonb("private_jwk").$type<Jwk>().notNull(),
  publicJwk: jsonb("public_jwk").$type<Jwk>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Mapping of a local note to its syndicated copy on another network. */
export const syndication = pgTable(
  "syndication",
  {
    id: text("id").primaryKey(), // ULID
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    network: text("network").notNull(), // "bluesky"
    remoteUri: text("remote_uri").notNull(), // at:// uri
    remoteCid: text("remote_cid"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("syndication_note_network_idx").on(t.noteId, t.network),
  ],
);
