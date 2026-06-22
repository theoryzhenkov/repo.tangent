CREATE TABLE "actors" (
	"uri" text PRIMARY KEY NOT NULL,
	"handle" text,
	"name" text,
	"inbox_url" text NOT NULL,
	"shared_inbox_url" text,
	"raw" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "followers" (
	"actor_uri" text PRIMARY KEY NOT NULL,
	"since" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_objects" (
	"id" text PRIMARY KEY NOT NULL,
	"uri" text NOT NULL,
	"type" text NOT NULL,
	"actor_uri" text NOT NULL,
	"target_note_id" text,
	"raw" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keys" (
	"type" text PRIMARY KEY NOT NULL,
	"private_jwk" jsonb NOT NULL,
	"public_jwk" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"alt" text,
	"byte_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"uri" text NOT NULL,
	"html" text NOT NULL,
	"text" text NOT NULL,
	"in_reply_to" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "syndication" (
	"id" text PRIMARY KEY NOT NULL,
	"note_id" text NOT NULL,
	"network" text NOT NULL,
	"remote_uri" text NOT NULL,
	"remote_cid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "followers" ADD CONSTRAINT "followers_actor_uri_actors_uri_fk" FOREIGN KEY ("actor_uri") REFERENCES "public"."actors"("uri") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_objects" ADD CONSTRAINT "inbox_objects_target_note_id_notes_id_fk" FOREIGN KEY ("target_note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syndication" ADD CONSTRAINT "syndication_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_objects_uri_idx" ON "inbox_objects" USING btree ("uri");--> statement-breakpoint
CREATE INDEX "inbox_objects_target_idx" ON "inbox_objects" USING btree ("target_note_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notes_uri_idx" ON "notes" USING btree ("uri");--> statement-breakpoint
CREATE UNIQUE INDEX "syndication_note_network_idx" ON "syndication" USING btree ("note_id","network");