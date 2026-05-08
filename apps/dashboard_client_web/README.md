# dashboard_client_web

Next.js 16 App Router app serving two surfaces: blog and financial dashboard.

Part of the [tradelunch](../../README.md) monorepo. See repo root [`CLAUDE.md`](../../CLAUDE.md) for architecture and conventions.

---

## Run

From repo root (preferred):

```sh
pnpm dev:web                                    # http://localhost:3001
pnpm --filter dashboard_client_web build
pnpm --filter dashboard_client_web start:pm2    # production via PM2
pnpm --filter dashboard_client_web lint         # next lint --max-warnings 0
pnpm --filter dashboard_client_web check-types  # tsc --noEmit
```

From this directory:

```sh
pnpm dev      # next dev --turbopack -p 3001
pnpm build    # next build
pnpm start    # next start -p 3000
```

---

## Ports

- Dev: `3001`
- Production: `3000`

---

## Environment

`.env`, `.env.local`, `.env.production`, `.env.example` — see `.env.example` for required keys. No `env.schema.ts` validator yet (planned in Phase 3).

---

## Routes

- `/` — landing
- `/blog/@taeklim` — blog list (server-rendered, infinite scroll)
- `/blog/[id]` — post detail (Markdown + KaTeX + prism)
- `/dashboard` — financial markets snapshot (Phase 2-simple, in progress)
- `/dashboard/preview/cards`, `/dashboard/preview/table` — display variant previews (Cycle 2)

---

## Directory layout

Strict layout — see [`.claude/rules/nexjts.md`](../../.claude/rules/nexjts.md):

```
app/         App Router (pages, layouts, actions/, api/)
apis/        Fetch wrappers (.api.ts, .mock.api.ts)
hooks/       Custom hooks (.hook.ts, .query.client.ts)
components/  Domain UI; atoms in components/ui/ (shadcn pattern)
lib/         Third-party init + cn util
utils/       Pure business helpers
types/       Global TS types
i18n/        next-intl config
messages/    Locale dictionaries (en, ko)
styles/      globals.css
public/      Static assets
```

Path alias `@/*` resolves from this directory. Cross-workspace imports use `@repo/*`.
