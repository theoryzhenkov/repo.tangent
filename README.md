# tangent

Self-hosted ActivityPub presence for **theor.net**, built on
[Fedify](https://fedify.dev), with [Bluesky](https://bsky.app) syndication.

`tangent` is a headless backend. It owns short **notes** — the only content
that federates. Long-form **pages** live as MDX in the Home repo and never
federate; announcing a page just emits a note that links to it. The Home site
is the single rendered website and reads notes from this service.

## Identity

- Fediverse: `@theor@theor.net` (WebFinger served at `theor.net`).
- ActivityPub server origin: `https://ap.theor.net` (split-domain).
- Bluesky: `@theor.net` (native POSSE via AT Protocol).

## Stack

- Runtime: **Bun** + **Hono**
- Federation: **Fedify** (durable KV + queue on Postgres via `@fedify/postgres`)
- Storage: **Postgres** + **Drizzle ORM** (app data and federation state)
- Syndication: **`@atproto/api`** (Bluesky)

## Development

```sh
cp .env.example .env   # set DATABASE_URL
bun install
bun run db:generate    # generate SQL migrations from src/db/schema.ts
bun run db:migrate     # apply migrations
bun run dev            # http://localhost:8787  (/healthz, /readyz)
```

## Build milestones

- **M0** — scaffold: Bun/Hono/Postgres/Drizzle, health/readiness. _(current)_
- **M1** — actor + WebFinger (resolvable from Mastodon).
- **M2** — outbox + `/api/notes` read API; Home reads from here.
- **M3** — inbox: follows.
- **M4** — compose + deliver `Create(Note)` to followers.
- **M5** — replies / likes / boosts / deletes + thread API.
- **M6** — Bluesky POSSE.
- **M7** — deploy (ops_atlas) + migrate off Ghost ActivityPub.
