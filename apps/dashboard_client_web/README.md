# dashboard_client_web

Next.js 16 App Router app — the user-facing frontend of the [tradelunch](../../README.md) monorepo.
See repo root [`CLAUDE.md`](../../CLAUDE.md) for full architecture and conventions.

## Why

This is the website visitors actually see — the blog and the financial dashboard in one app.
It renders pages (SSR + client) and talks to the Express API ([`dashboard_server`](../dashboard_server/README.md)) for data.

## What

- **Blog / portfolio** — post list with infinite scroll, post detail with Markdown + KaTeX + prism.
- **Financial dashboard** — read-only market snapshot (FX, crypto, indices, rates, stocks).
- **Two runtimes**: browser client (`"use client"`) + Next.js server (RSC, Server Actions in `app/actions/`, Route Handlers in `app/api/`).
- Auth via Clerk, i18n via next-intl (`en` / `ko`), data fetching via TanStack Query (client) or `apis/` fetchers (server).

## How

```sh
pnpm dev:web                                    # dev → http://localhost:3001
pnpm --filter dashboard_client_web build        # production build
pnpm --filter dashboard_client_web start:pm2    # production via PM2 (port 3000)
pnpm --filter dashboard_client_web lint         # next lint --max-warnings 0
pnpm --filter dashboard_client_web check-types  # tsc --noEmit
```

- Ports: dev `3001`, prod `3000`.
- Env: `.env.local` etc. — see `.env.example` for required keys.
- Directory layout is strict — see [`.claude/rules/nexjts.md`](../../.claude/rules/nexjts.md).
  Path alias `@/*` is this dir; cross-workspace imports use `@repo/*`.
