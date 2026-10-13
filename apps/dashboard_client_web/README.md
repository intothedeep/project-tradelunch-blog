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
