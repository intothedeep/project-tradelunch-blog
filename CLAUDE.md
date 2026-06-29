# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Authoritative Rule Sources

Read these before making changes — they override anything inferred from existing code:

- `.claude/CLAUDE.md` — core engineering principles (KISS/YAGNI, SRP, functional core, layering, ≤300 LOC per file, naming, workflow discipline)
- `.claude/rules/nexjts.md` — Next.js + Turborepo conventions (directory layout, file naming suffixes, component boundaries)
- `.claude/rules/typescript.md` — TS imports must be extensionless
- `.claude/rules/python.md`, `.claude/rules/rust.md` — language-specific (only relevant if those stacks appear)
- `.claude/rules/docs.md` — doc lifecycle: archiving completed work to `_docs/archive/` + the archive READ GUARD (do not read archives unless investigating history)

## Active Work

See [`00.plan.md`](./00.plan.md) and [`00.tasks.md`](./00.tasks.md) at repo root. Currently active: **Phase 2-simple — Financial Dashboard MVP** (branch `feature/finance`). Two display-variant preview routes exist for evaluation: `/dashboard/preview/cards` and `/dashboard/preview/table`. The winner is rolled into `/dashboard` in Cycle 3.

## Repo Topology

pnpm + Turborepo monorepo (`workspaces: ["apps/*", "packages/*"]`). Node 24 (`.nvmrc`), `auto-install-peers=true`.

```
apps/
  dashboard_client_web/   Next.js 16 App Router, React 19, Tailwind v4, runs on :3001 (dev) / :3000 (prod)
  dashboard_server/       Express 5 + Sequelize/pg + AWS S3 + SSH tunnel, serves blog content
packages/
  @repo/ui                Shared React components (built to dist/, tsc + tailwind)
  @repo/axios             Shared axios client (rollup → dist/)
  @repo/markdown-parsing  Markdown pipeline (rollup → dist/, has Jest tests)
  @repo/assets            Static assets (images, fonts, icons)
  @repo/types             Shared types
  @repo/{tailwind,eslint,typescript,jest}-config   Shared configs
```

Dependency direction is strictly `apps → packages`. No reverse imports.

`turbo dev` depends on `@repo/markdown-parsing#build` — that package must build before dev can start.

## Runtime Terminology

The owner names three runtimes in conversation. Use these terms exactly:

- **front** / **client** — client-side React running in the browser (the `"use client"` components of `apps/dashboard_client_web`).
- **ssr server** / **next server** — the Next.js server runtime of `apps/dashboard_client_web`: React Server Components, Server Actions (`app/actions/`), and Route Handlers (`app/api/`). Runs on Vercel as the frontend project's server side.
- **express** / **backend** — `apps/dashboard_server`, the standalone Express API served at `/v1/api/*` (its own Vercel project, pg `Pool` → Supabase).

Note: `dashboard_client_web` has BOTH a browser-client and a Next-server runtime, while `dashboard_server` is purely the Express API.

## Common Commands

Run from repo root unless noted:

```sh
pnpm dev                            # turbo run dev (all apps in parallel)
pnpm dev:web                        # client app only (port 3001)
pnpm dev:server                     # server app only (note: script targets `article_server` workspace which does not exist — use pnpm --filter dashboard_server dev)
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
pnpm --filter dashboard_client_web start:pm2    # pm2 production start
pnpm --filter dashboard_client_web lint         # next lint --max-warnings 0

# dashboard_server
pnpm --filter dashboard_server dev              # tsx watch src/index.ts
pnpm --filter dashboard_server build            # tsc + tsc-alias
pnpm --filter dashboard_server test             # jest
pnpm --filter dashboard_server test:watch
pnpm --filter dashboard_server test:coverage
pnpm --filter dashboard_server test:unit        # jest --testPathPattern=utils
pnpm --filter dashboard_server test:integration # jest --testPathPattern=routes

# packages/markdown-parsing (only package with test suite)
pnpm --filter @repo/markdown-parsing test
pnpm --filter @repo/markdown-parsing test -- --testPathPattern=<name>   # single file
pnpm --filter @repo/markdown-parsing build      # rollup
```

There is **no root-level test script** — tests live in `apps/dashboard_server` (jest) and `packages/markdown-parsing` (jest). The client app currently has no test runner configured.

## Architecture Notes

### dashboard_client_web (Next.js 16)

Strict directory layout enforced by `.claude/rules/nexjts.md`:

- `app/` — App Router routes; `app/actions/` = Server Actions, `app/api/` = Route Handlers
- `apis/` — fetch wrappers (suffix `.api.ts` for real, `.mock.api.ts` for mock)
- `hooks/` — custom hooks (suffix `.hook.ts`); React Query wrappers use `.query.client.ts`
- `components/` — UI by domain; atoms in `components/ui/` (shadcn pattern)
- `lib/` — third-party init / `cn` util; `utils/` — pure business helpers
- `types/`, `i18n/`, `messages/{en,ko}/`, `styles/`, `public/`

Default to **Server Components**; add `"use client"` only when interactivity, hooks, or browser APIs are needed. Server Components may call `apis/` fetchers directly. Client fetching goes through TanStack Query hooks. Jotai is installed for shared client state but currently unused.

Path alias `@/*` resolves from app root (`tsconfig.json`). Cross-workspace imports use `@repo/*`.

i18n uses `next-intl` with config at `apps/dashboard_client_web/i18n.ts` (referenced via `next-intl.path` in package.json). Locale messages in `messages/{en,ko}/`.

### dashboard_server (Express)

Layered MVC under `src/`:
- `controllers/` → `helpers/` (services) → `lib/` (sequelize models, S3 client, SSH tunnel)
- `middlewares/`, `utils/`, `config/` (env loading)
- Tests in `__tests__/` mirror `src/` structure
- Build: `tsc + tsc-alias` (path aliases via `ts-aliases/register`)
- Postgres via `sequelize` + raw SQL preferred per `.claude/CLAUDE.md` §7

### Workflow Docs (rule)

Exactly **three** living root-level docs — do not create per-feature plan/task/ADR variants;
fold new work into these:

- `00.plan.md` — product intent + roadmap + architecture decisions (owned by product-manager agent)
- `00.tasks.md` — atomic task breakdown for every phase (owned by product-manager agent)
- `01.status.md` — progress log: **one line per update, sequential, newest at the bottom**; append a
  single line per change, never prose blocks (owned by engineer agent)

Rules:
- When starting non-trivial work, read all three first; update in place.
- Do **not** spin up extra docs (`00.<feature>.plan.md`, `*.arch.md`, `00.migration.md`, etc.).
  A large sub-effort becomes a section/phase inside `00.plan.md` + `00.tasks.md`.
- use `_docs/` (gitignored, local-only archive) — they are not deleted and not committed.

## Naming Conventions (Quick Reference)

From `.claude/CLAUDE.md` §17 and `.claude/rules/nexjts.md`:

- API: `[method]-[name].api.ts` (e.g. `getPosts.api.ts`); mock: `*.mock.api.ts`
- Hook: `useFoo.hook.ts`; query client: `useFoo.query.client.ts`
- Server/client component split: `Foo.server.tsx` / `Foo.client.tsx` when ambiguity matters
- Folder triplet: `use-api/`, `use-ws/`, `use-poll/` for fetching patterns
- Booleans: `is/has/can` prefix; functions: verb-based; data: noun-based
- TS imports: **no file extensions**

## Soft-Delete Convention

Per `.claude/CLAUDE.md` "rm -rf" rule: never delete files directly. Rename with `x_` prefix so the user can verify and remove manually.

## Environment

`.env`, `.env.local`, `.env.production`, `.env.example` exist per app and in `packages/axios`. Config precedence: env vars > config files > defaults. Zod is in `dashboard_client_web` deps but no `env.schema.ts` validator exists yet.
