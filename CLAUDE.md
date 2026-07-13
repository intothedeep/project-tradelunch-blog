# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
It holds **repo facts only**; normative rules live in `.claude/CLAUDE.md` + `.claude/rules/*`.

## Authoritative Rule Sources

Read these before making changes — they override anything inferred from existing code:

- `.claude/CLAUDE.md` — core engineering principles (KISS/YAGNI, SRP, functional core, layering, 300-LOC soft limit, naming, agent guardrails, soft-delete `x_` rule)
- `.claude/rules/nexjts.md` — Next.js conventions (component boundaries, naming suffixes, styling; TS imports extensionless)
- `.claude/rules/python.md` — Python conventions (`apps/blog_agent`)
- `.claude/rules/docs.md` — doc lifecycle: three living docs, archiving to `_docs/archive/` + the archive READ GUARD (do not read archives unless investigating history)

## Active Work

See [`00.plan.md`](./00.plan.md) and [`00.tasks.md`](./00.tasks.md). This repo is **blog-only since
2026-07-09** — the finance surface lives in the separate `project_tradelunch_finance` repo.
Currently active: **Phase Y — Log** (Threads-style personal microfeed, `/log/[username]`), M1 shipped
plus UX iterations ongoing on `main`.

## Repo Topology

pnpm + Turborepo monorepo (`workspaces: ["apps/*", "packages/*"]`). Node 24 (`.nvmrc`), pnpm 9.15.9,
`auto-install-peers=true`.

```
apps/
  dashboard_client_web/   Next.js 16 App Router, React 19, Tailwind v4, runs on :3001 (dev) / :3000 (prod)
  dashboard_server/       Express 5 + pg Pool (raw SQL) → Supabase; images → OCI Object Storage via src/lib/storage (STORAGE_PROVIDER)
  blog_agent/             Python LangGraph publishing agent (uv-managed; direct DB/storage writer, publish_oneshot.py)
packages/
  @repo/db                Supabase migrations + seed + db:* CLI scripts (blog DB schema source of truth)
  @repo/types             Shared API-boundary types (raw TS, no build step)
  @repo/assets            Static assets (images, fonts, icons)
  @repo/{tailwind,eslint,typescript,jest}-config   Shared configs
```

Dependency direction is strictly `apps → packages`. No reverse imports.

Schema SSOT note: `packages/db/schema/tradelunch.schema.sql` (`@repo/db`) is the single
human-reference snapshot of the accumulated blog schema. Applied truth =
`packages/db/supabase/migrations/`. Update the snapshot on any DDL change.

## Runtime Terminology

The owner names three runtimes in conversation. Use these terms exactly:

- **front** / **client** — client-side React running in the browser (the `"use client"` components of `apps/dashboard_client_web`).
- **ssr server** / **next server** — the Next.js server runtime of `apps/dashboard_client_web`: React Server Components, Server Actions (`app/actions/`), and Route Handlers (`app/api/`). Runs on Vercel as the frontend project's server side.
- **express** / **backend** — `apps/dashboard_server`, the standalone Express API served at `/v1/api/*` (its own Vercel project at `blogapi.prettylog.com`, pg `Pool` → Supabase).

Note: `dashboard_client_web` has BOTH a browser-client and a Next-server runtime, while `dashboard_server` is purely the Express API.

## Common Commands

Run from repo root unless noted:

```sh
pnpm dev                            # turbo run dev (all apps in parallel)
pnpm dev:web                        # client app only (port 3001)
pnpm dev:server                     # dashboard_server only (tsx watch)
pnpm build                          # turbo run build
pnpm lint                           # turbo run lint
pnpm check-types                    # turbo run check-types (tsc --noEmit per workspace)
pnpm format                         # prettier --write **/*.{ts,tsx,md}
```

Per-workspace (use `pnpm --filter <name> <script>`):

```sh
# dashboard_client_web
pnpm --filter dashboard_client_web dev          # next dev --turbopack -p 3001
pnpm --filter dashboard_client_web build        # next build
pnpm --filter dashboard_client_web lint         # next lint --max-warnings 0

# dashboard_server
pnpm --filter dashboard_server dev              # tsx watch src/index.ts
pnpm --filter dashboard_server build            # tsc + tsc-alias
pnpm --filter dashboard_server test             # jest
pnpm --filter dashboard_server test:unit        # jest --testPathPattern=utils
pnpm --filter dashboard_server test:integration # jest --testPathPattern=routes
```

There is **no root-level test script** — jest lives in `apps/dashboard_server`; the client app has
vitest for pure utils; `apps/blog_agent` uses pytest via `uv run`.

## Architecture Notes

### dashboard_client_web (Next.js 16)

Strict directory layout enforced by `.claude/rules/nexjts.md`:

- `app/` — App Router routes; `app/actions/` = Server Actions, `app/api/` = Route Handlers
- `apis/` — fetch wrappers (suffix `.api.ts`); native-fetch cores `http.{core,client,server}.ts` (axios retired 2026-07-08 — unwrap the `{success,data}` envelope EXACTLY ONCE)
- `hooks/` — custom hooks (suffix `.hook.ts`); React Query wrappers use `.query.client.ts`
- `components/` — UI by domain; atoms in `components/ui/` (shadcn pattern)
- `lib/` — third-party init / `cn` util; `utils/` — pure business helpers
- `types/`, `i18n/`, `messages/{en,ko}/`, `styles/`, `public/`

Default to **Server Components**; add `"use client"` only when interactivity, hooks, or browser APIs are needed. Server Components may call `apis/` fetchers directly. Client fetching goes through TanStack Query hooks.

Path alias `@/*` resolves from app root (`tsconfig.json`). Cross-workspace imports use `@repo/*`.
i18n uses `next-intl` (config `i18n.ts`, messages in `messages/{en,ko}/`).

Post/comment/log ids are **BIGINT beyond 2^53 — keep them strings end-to-end; never `Number()`/`parseInt` them.**

### dashboard_server (Express)

Layered MVC under `src/`:

- `controllers/` → `helpers/` (services) → `lib/` (pg Pool, storage providers)
- `middlewares/`, `utils/`, `config/` (env loading, zod `env.schema.ts`)
- Tests in `__tests__/` mirror `src/` structure; build: `tsc + tsc-alias`
- Postgres via `pg` Pool + raw SQL (no Sequelize, no supabase-js); responses use the `{success,data}` envelope (`sendOk`/`sendError`)
- Never hard-DELETE domain rows — `deleted_at` tombstone + mask at read

### Workflow Docs (rule)

Three living root docs only — `00.plan.md`, `00.tasks.md` (product-manager), `01.status.md` (engineer).
Read all three before non-trivial work; update in place; no per-feature variants.
Full lifecycle + archive READ GUARD: `.claude/rules/docs.md`.

## Environment

`.env`, `.env.local`, `.env.production`, `.env.example` exist per app. Config precedence: env vars > config files > defaults.

### Database connection vars (Supabase)

There is **no `DATABASE_URL` in the apps** — the apps read the Vercel↔Supabase integration vars:

- `POSTGRES_URL` — **pooled** (transaction pooler, port `6543`) → runtime pg `Pool`.
- `POSTGRES_URL_NON_POOLING` — **direct/session** (port `5432`) → migrations / direct queries.

`dashboard_server` `src/config/env.schema.ts` resolves its internal `DATABASE_URL`/`DATABASE_URL_DIRECT` constants _from_ those two (the constant name is legacy; the env var is `POSTGRES_URL*`). In GitHub Actions only `supabase-keepalive.yml` touches the DB (secret `BLOG_SUPABASE_DATABASE_URL`, falling back to `DATABASE_URL` pre-cutover); the finance collector crons moved with the finance repo.

### Storage (images)

Provider-swappable module `apps/dashboard_server/src/lib/storage/` (Python mirror in
`apps/blog_agent/db/storage/`): `STORAGE_PROVIDER` (`oci` in prod), `STORAGE_BUCKET` (upload-only),
public URL = `{CDN_ASSETS}/{key}` (bucketless). OCI S3-compat requires checksum `WHEN_REQUIRED`
(botocore ≥1.36 default CRC breaks OCI multipart).
