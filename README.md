# tradelunch

Personal portfolio + blog for Taek Lim.

Live: [my.prettylog.com](https://my.prettylog.com)

> **Hosting status (2026-10-12):** both Vercel projects are down (HTTP 402, quota). The owner
> decided to leave Vercel for GCP. Design draft: [`gcp.design.md`](./gcp.design.md).

The finance dashboard moved to the separate `project_tradelunch_finance` repo on 2026-07-09.
This repo is blog-only.

---

## What's inside

pnpm + Turborepo monorepo, Node 24.

```text
apps/
  dashboard_client_web/   Next.js 16 App Router — blog + Log UI (SSR + client)
  dashboard_server/       Express 5 + pg Pool (raw SQL) → Supabase Postgres — /v1/api/*
  blog_agent/             Python (uv) — markdown blog publisher, writes DB + storage directly
packages/
  @repo/db                Supabase migrations + seed + schema snapshot (schema source of truth)
  @repo/types             Shared API-boundary types
  @repo/assets            Static assets (images, fonts, icons)
  @repo/{tailwind,eslint,typescript,jest}-config
```

Per-app READMEs:

- [`apps/dashboard_client_web`](./apps/dashboard_client_web/README.md) — Next.js client + SSR
- [`apps/dashboard_server`](./apps/dashboard_server/README.md) — Express API
- [`apps/blog_agent`](./apps/blog_agent/README.md) — markdown publisher (Python)

Product surfaces:

- **Blog / portfolio** — multi-user technical posts (Clerk auth), Markdown + LaTeX, likes,
  comments, saved posts, category/tag filters, in-app authoring at `/write`.
- **Log** — Threads-style microfeed at `/log` and `/log/[username]`: recursive replies, todo
  marks (owner-only), likes, follows, following timeline.

---

## Runtime layout

```text
browser
  └─ Cloudflare (DNS; edge cache planned — Phase CF2)
       ├─ my.prettylog.com       → dashboard_client_web (Next.js: RSC, Server Actions, Route Handlers)
       │                              └─ calls the API below
       ├─ blog-api.prettylog.com  → dashboard_server (Express, /v1/api/*)
       │                              └─ pg Pool → Supabase Postgres (POSTGRES_URL, pooled :6543)
       └─ blog-assets.prettylog.com → OCI Object Storage (images, proxied by Cloudflare)

blog_agent (local CLI) ──► Supabase Postgres + OCI Object Storage (direct write)
```

- DB connection vars: `POSTGRES_URL` (pooled, runtime) and `POSTGRES_URL_NON_POOLING` (direct,
  migrations). There is no `DATABASE_URL` in the apps.
- Image storage is provider-swappable (`STORAGE_PROVIDER`, `oci` in prod). Public URL =
  `{CDN_ASSETS}/{key}`.
- Post, comment and log ids are BIGINT beyond 2^53 — they stay strings end to end.

---

## Quick start

Requires Node 24 (`nvm use`) and pnpm 9 (`corepack enable`). Use pnpm only — never npm or yarn.

```sh
pnpm install
pnpm dev             # all apps in parallel
pnpm dev:web         # client app only — http://localhost:3000
LOG_REQUESTS=false pnpm dev:web   # same, without the per-request JSON log lines (#58)
pnpm dev:server      # Express API only
pnpm dev:agent       # blog_agent CLI
```

Other common scripts:

```sh
pnpm build           # production build (turbo run build)
pnpm lint            # lint across workspaces
pnpm check-types     # tsc --noEmit per workspace (+ mypy for blog_agent)
pnpm format          # prettier write
```

Env files live per app (`.env`, `.env.local`, `.env.production`, `.env.example`).

### Local web against the production API (HTTPS, live Clerk keys)

Serves the local web at `https://local.prettylog.com` on port 443.
One-time setup (hosts entry, CORS origin, mkcert certificate): [`apps/dashboard_client_web/LOCAL_PROD_API.md`](./apps/dashboard_client_web/LOCAL_PROD_API.md).
The certificate lives outside the repo, in `~/.config/prettylog/certs/`.

```sh
# from the repo root
read -s 'PK?pk_live: ' && echo && read -s 'SK?sk_live: ' && echo

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$PK CLERK_SECRET_KEY=$SK \
NEXT_PUBLIC_API_BASE=https://blog-api.prettylog.com \
pnpm --filter dashboard_client_web exec next dev --turbopack -p 443 -H 0.0.0.0 --experimental-https \
  --experimental-https-key "$HOME/.config/prettylog/certs/local-key.pem" \
  --experimental-https-cert "$HOME/.config/prettylog/certs/local.pem"
```

---

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — repo topology, commands, architecture
- [`00.plan.md`](./00.plan.md) — product intent + roadmap
- [`00.tasks.md`](./00.tasks.md) — atomic task list (active: Phase CF2 edge cache, Log gates)
- [`01.status.md`](./01.status.md) — running status log
- [`log.plan.md`](./log.plan.md) — Log phases (Y, Y-TD, Y M2)
- [`decisions.plan.md`](./decisions.plan.md) — resolved architecture decisions
- [`gcp.design.md`](./gcp.design.md) — Vercel → GCP hosting design (draft)
- [`cc.design.md`](./cc.design.md) / [`cc.report.md`](./cc.report.md) — Phase CC (cache and cost): route groups, perf measurement. `cacheComponents` is OFF in production. See the [web README](./apps/dashboard_client_web/README.md#app-layout-route-groups).
- [`.claude/`](./.claude/) — agent harness: engineering principles and rules

---

## Admin bootstrap

There is **no admin-grant UI** by design — users are lazy-provisioned with `is_admin = false`.
To promote the owner, run a **one-time** SQL statement in the Supabase SQL Editor _after_ that
account has signed up and completed onboarding (so the `users` row exists):

```sql
UPDATE users SET is_admin = true WHERE username = '<owner-username>';
```

Match by `username` or `clerk_user_id` — **never `email`** (lazy-provisioned users have a NULL
`email`, so an email match silently updates zero rows). This single-owner bootstrap is intentionally
manual; an env/config allowlist would be over-engineering for one admin.

---

## Tech stack

Next.js 16 · React 19 · TypeScript strict · Tailwind v4 · Radix UI · shadcn/ui · lucide-react ·
Jotai · TanStack Query v5 · next-intl · Clerk (auth) · Express 5 · pg Pool · Supabase Postgres ·
OCI Object Storage · Cloudflare · Python (uv, LangGraph) · GitHub Actions · pnpm 9 · Turborepo ·
hosting: Vercel → GCP (in progress)
