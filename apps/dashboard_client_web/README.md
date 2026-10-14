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
pnpm dev:web                                    # dev → http://localhost:3000
LOG_REQUESTS=false pnpm dev:web                 # same, without the per-request JSON log lines
pnpm --filter dashboard_client_web build        # production build
pnpm --filter dashboard_client_web start:pm2    # production via PM2 (port 3000)
pnpm --filter dashboard_client_web lint         # next lint --max-warnings 0
pnpm --filter dashboard_client_web check-types  # tsc --noEmit
```

- Ports: dev and prod both `3000`.
- Local web against the production API (no local Express): [`LOCAL_PROD_API.md`](./LOCAL_PROD_API.md).
- Env: `.env.local` etc. — see `.env.example` for required keys.
- Directory layout is strict — see [`.claude/rules/nexjts.md`](../../.claude/rules/nexjts.md).
  Path alias `@/*` is this dir; cross-workspace imports use `@repo/*`.

## App layout (route groups)

Phase CC split the shell into route groups. URLs did not change (groups add no path segment).
Design: [`cc.design.md`](../../cc.design.md) §15.

```text
app/(shell)/
├── layout.tsx                 left rail, rendered once for every screen below
├── (feed)/layout.tsx          right rail #1: home, tags
├── [handle]/
│   ├── layout.tsx             handle must start with '@', else 404
│   ├── (rail)/layout.tsx      right rail #2: posts, projects, saved
│   ├── [slug]/                post detail: own layout
│   ├── about/  resume/  me/   own layouts
└── write/                     own layout
```

| Screens | Right rail | Owner of the rail |
| --- | --- | --- |
| `/`, `/tags/[tag]` | one `HomeRightRail` | `(shell)/(feed)/layout.tsx` |
| `/@u/posts`, `/@u/projects`, `/@u/projects/<p>`, `/@u/saved` | one `HomeRightRail` for the same handle | `(shell)/[handle]/(rail)/layout.tsx` |
| post detail, about, resume, me, write | own layout, no shared rail | each screen |

- The left rail is rendered once in `(shell)/layout.tsx`, so it survives every move.
- Each shared right rail stays mounted while the user moves inside its group.
- The profile card sits in the `(rail)` layout. A client slot shows it on `/@u/posts` only.
- Unknown user, project or post returns a real HTTP 404.
  The layout gates it (`notFound()` in `(rail)/layout.tsx`), because a `loading.tsx` would flush a 200 shell first.
- Anonymous `/@u/me` and `/@u/saved` return 404.

## Section tones

Each section has a pastel tone. The tone shows in the top bar and in the left rail items.

| Piece | Where | Note |
| --- | --- | --- |
| Tokens `--tone-home`, `-projects`, `-saved`, `-about`, `-posts`, `-write` | `styles/globals.css` | light and dark values |
| Classes `bg-tone-*` | same file (`--color-tone-*`) | Tailwind v4 theme colors |
| `sectionTone(pathname)`, `toneOfNavKey(key)` | `utils/section-tone.ts` | pure: route or nav key to tone |
| `TONE_BG`, `TONE_BG_FAINT` | same file | literal class names, so Tailwind sees them |

- The top bar uses `TONE_BG_FAINT` (`bg-tone-*/15`, 15% of the tone over the page).
- A route with no tone uses `bg-background/95`.
- `resume` shares the `about` tone. The "My blog" nav item uses the `posts` tone.
- Tag pages: the page title box is plain gray (`bg-muted`; tags are filters, not sections, owner 2026-10-14). The header still takes the home tone because `sectionTone()` maps `/tags/*` to `home`.

## Performance measurement (Phase CC)

**Purpose:** measure how a change affects page loads, moves between pages and server fetches on production.
Design and metrics: [`cc.design.md`](../../cc.design.md) §5 and §14. Stage report: [`cc.report.md`](../../cc.report.md).

| Tool | Runs where | Measures |
| --- | --- | --- |
| `_scripts/perf/cc-measure.mjs` | your Mac, HTTP only | TTFB and bytes for walks W1 to W4, anonymous and signed in |
| `_scripts/perf/ssr-fetch-count.mjs` | your Mac, after a `cc-measure` run | Next-server `ssr_fetch` lines per MISS render (QW1 metric) |
| `.github/workflows/cc-browser-measure.yml` | GitHub runner, headless chromium | `_rsc` count on Back, 10 s request peak, prefetch per link, hydration errors, `[nav]` time |
| `.github/workflows/cc-build.yml` | GitHub runner | build with `cacheComponents` ON, to list what must change. No deploy |

```sh
# HTTP measurement. --unit and --web-sha are required.
# --web-sha auto reads the deployed sha with one `gcloud compute ssh`; a literal sha skips the ssh.
node _scripts/perf/cc-measure.mjs --unit U3 --tag after1 --web-sha auto

# Server fetches per MISS render, from a finished run folder
node _scripts/perf/ssr-fetch-count.mjs deploy/traffic/review/cc/runs/<run folder> --arm anon

# Browser measurement (never on the Mac). Needs repo secret CLERK_SECRET_KEY_PROD.
gh workflow run cc-browser-measure.yml -f tag=after1 -f unit=U3 -f web_sha=<deployed sha>
gh run download <run id>      # fetch the artifact

# cacheComponents preview build (runner only)
gh workflow run cc-build.yml
```

- Output folder: `deploy/traffic/review/cc/runs/<time>_<unit>_<tag>_<websha7>/`.
  It holds `raw.jsonl`, `manifest.json`, `summary.csv` and copies of the scripts.
- Pace: requests at least 1 s apart, so the Cloudflare limit (70 requests per 10 s since decision #106, was 50 in decision #68) stays far away.
- `cc-measure.mjs` has no browser. Its bytes are full-tree RSC bytes. Never compare them with browser bytes.
- Harness v2 (2026-10-14): the browser script records bytes in the order `body()`, `request.sizes()`, `content-length`.
  It leaves a byte sum empty when a size is unknown. It adds a W1 warmup per run.
  Runs from before v2 use another byte definition. Ledger: [`_scripts/perf/CHANGELOG.md`](../../_scripts/perf/CHANGELOG.md).
- Verdicts and run ledger: `deploy/traffic/review/cc/`.

## cacheComponents is ON in production (U4)

- `next.config.ts` sets `cacheComponents: true`. Production runs U4 `181e6ed`. Phase CC closed 2026-10-14 (decision #111).
- U4 was tried twice and reverted (signed-in main metric 329 to 434 ms, guard G-a failed).
  The A-B-A run was invalid (no verdict). The owner kept U4 in production without a speed verdict (decision #106).
  Verdicts: [`u4-verdict.md`](../../deploy/traffic/review/cc/u4-verdict.md), [`u4-aba-verdict.md`](../../deploy/traffic/review/cc/u4-aba-verdict.md).
- U5 (`'use cache'` on public reads) was measured and dropped: MISS TTFB 302 to 316 ms, and `Connection closed.` render errors on the projects routes (decision #111).
  U6 (revalidate route) was dropped (decision #109).

**Real 404 gate (proxy).** With `cacheComponents`, a layout cannot answer 404 after it streams, so the proxy answers it.

| File | Role |
| --- | --- |
| `proxy.ts` | runs the gate before render. A missing page is rewritten to a path with no route, so Next answers a real HTTP 404 |
| `utils/notFoundGate.ts` | pure path classifier: user, project, post, owner-only (`/@u/me`, `/@u/saved`) |
| `apis/existence.proxy.ts` | existence probe to the API. Only a 404 means missing. Any other status, error or timeout passes (fail-open) |

- Signed-in client navigation is checked too (decision #103). Signed-in prefetch skips the check (decision #106).
- An unknown top-level path such as `/nope` is a real 404 (attempt 1 returned 500).

**`unstable_rethrow` rule.** In every server `catch` (fetchers, leaves, pages, metadata), call `unstable_rethrow(error)` from `next/navigation` first.

- Why: on a new param path, Next prerenders the static shell at request time (runtime prerender).
  Uncached fetches hang until the shell is done, then Next rejects them. A `catch` that logs this signal writes a false ERROR.
- Without the rule: 8 false ERROR lines after deploy (`u4o-prerender-errors.md`). With it: 0 new lines.

**Cache and edge.**

- Cloudflare rate limit is 70 requests per 10 s (decision #106). Guard G-a: at most 60 in 10 s.
- Purge is manual. A fix can show an old value for up to 1 day (decision #109).
  If it is urgent, purge the Cloudflare cache by hand.
- `cc-build.yml` builds with the flag ON inside the runner, to list what must change. It never changes the repo.

## How to run from scratch for local dev

Local web, signed in, against the production API (`https://blog-api.prettylog.com`).
Why each step is needed: [`LOCAL_PROD_API.md`](./LOCAL_PROD_API.md) mode C.

```text
Mac                                            VM
1. /etc/hosts  local.prettylog.com → 127.0.0.1
2. mkcert CA (first --experimental-https run)
3. certificate for local.prettylog.com
                                               4. ALLOWED_ORIGINS += https://local.prettylog.com
5. dev server: prod Clerk keys, 443, HTTPS
6. open https://local.prettylog.com
```

**Once (setup)**

```sh
# 1. Mac: send local.prettylog.com to this Mac
echo '127.0.0.1 local.prettylog.com' | sudo tee -a /etc/hosts

# 2. Mac: let Next download mkcert and install its local CA (asks for the Mac password).
#    Stop it with Ctrl+C once it prints "Ready". Skip if ~/Library/Caches/mkcert/ exists.
cd ~/Documents/00_projects/project_tradelunch
pnpm --filter dashboard_client_web exec next dev -p 3000 --experimental-https

# 3. Mac: a certificate that names local.prettylog.com (gitignored: certificates/)
cd apps/dashboard_client_web
MKCERT=$(ls ~/Library/Caches/mkcert/mkcert-* | head -1)
mkdir -p certificates
"$MKCERT" -key-file certificates/local-key.pem -cert-file certificates/local.pem \
  local.prettylog.com localhost 127.0.0.1
openssl x509 -in certificates/local.pem -noout -ext subjectAltName   # shows DNS:local.prettylog.com
cd ../..

# 4. VM: allow the origin on the prod API (no port, no quotes, no trailing /)
grep '^ALLOWED_ORIGINS' ~/prettylog/shared/api.env
#    must be: ALLOWED_ORIGINS=https://my.prettylog.com,https://local.prettylog.com
vi ~/prettylog/shared/api.env                       # fix it if different
#    Full path: a bare `ecosystem` works only inside ~/prettylog
#    ("Process or Namespace ecosystem not found" elsewhere). --update-env re-reads api.env.
pm2 restart ~/prettylog/ecosystem.config.cjs --only blog-api --update-env
pm2 env $(pm2 id blog-api | tr -dc '0-9') | grep ALLOWED_ORIGINS   # the running value

#    Mac: CORS preflight must answer 204 with this origin (500 = not allowed yet)
curl -s -o /dev/null -D - -X OPTIONS https://blog-api.prettylog.com/v1/api/users/me \
  -H 'Origin: https://local.prettylog.com' -H 'Access-Control-Request-Method: GET' \
  | grep -iE '^HTTP|access-control-allow-origin'
```

**Every time (run)**

```sh
# 5. Mac, repo root: production Clerk keys, typed hidden (not saved in history)
cd ~/Documents/00_projects/project_tradelunch
read -s 'PK?pk_live: ' && echo && read -s 'SK?sk_live: ' && echo

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$PK CLERK_SECRET_KEY=$SK \
NEXT_PUBLIC_API_BASE=https://blog-api.prettylog.com \
pnpm --filter dashboard_client_web exec next dev --turbopack -p 443 -H 0.0.0.0 --experimental-https \
--experimental-https-key certificates/local-key.pem --experimental-https-cert certificates/local.pem

#    Quiet: put LOG_REQUESTS=false in front (with the other variables) to drop the
#    per-request JSON lines (proxy.ts, decision #58). Default: on, like blog-api.

# 6. Browser: https://local.prettylog.com  (no port) → sign in → write a comment
#    Ctrl+C when done: 0.0.0.0 is reachable from the local network.
```

| Flag | Why |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | override the dev keys in `.env.local`; without them every signed-in call is 401 |
| `-p 443` | no port in the origin; Clerk rejects `:3000` |
| `-H 0.0.0.0` | macOS allows port 443 for a normal user only on `0.0.0.0` (`127.0.0.1:443` → `EACCES`) |
| `--experimental-https-key/-cert` | the certificate from step 3; paths are relative to this app dir (`--filter` runs here) |

Writes go to the **production** DB. Delete test comments afterwards.
