# Run the web locally against the production API

Use this to test the web app on the Mac without running Express. The web talks to the live
API at `https://blog-api.prettylog.com` (GCP VM).

| Mode | You can test | Clerk keys | Writes |
| --- | --- | --- | --- |
| **A. Read only** | pages, feed, post detail, SSR | dev (`.env.local`) | none |
| **B. API down** | the "posts unavailable" notice | dev (`.env.local`) | none |
| **C. Signed in** | comments, likes, saves, write | **production** (`pk_live` / `sk_live`) | **real, in the prod DB** |

## Why signed-in calls fail in mode A

```text
localhost:3000 + Clerk dev key ── token (iss = *.clerk.accounts.dev, azp = http://localhost:3000)
                                        ▼
prod API (CLERK_SECRET_KEY = sk_live) ── not our instance ──► 401 {"message":"unauthorized"}
```

The prod API accepts only tokens that pass two checks:

| Check | Set by |
| --- | --- |
| The token comes from the Clerk **production** instance | `CLERK_SECRET_KEY` in the VM `shared/api.env` |
| The token's `azp` (the web origin) is listed | `ALLOWED_ORIGINS` in the same file (`src/middlewares/resolveAuth.ts`, also the CORS list) |

Clerk production keys work only on `prettylog.com` and its subdomains, never on `localhost`.
Mode C therefore serves the local web as `https://local.prettylog.com` (port 443, no port in the URL).

---

Every mode prints one JSON line per request in the dev terminal (`proxy.ts`, decision #58),
the same line `blog-api` writes. Put `LOG_REQUESTS=false` in front of any command below to silence it.

## A. Read only

From the repo root:

```sh
NEXT_PUBLIC_API_BASE=https://blog-api.prettylog.com pnpm dev:web
# quiet: LOG_REQUESTS=false NEXT_PUBLIC_API_BASE=https://blog-api.prettylog.com pnpm dev:web
# open http://localhost:3000
```

- A variable in front of the command wins over `.env.local`.
- Unset `NEXT_PUBLIC_API_BASE` also works: the default is the prod API.
- The browser's own calls (load more, like) may fail CORS: the prod API allows only
  `https://my.prettylog.com`. The first page (SSR) is not affected.

## B. API down

```sh
NEXT_PUBLIC_API_BASE=http://127.0.0.1:9 pnpm dev:web
```

Pass: nav and rails render, and the post list shows "Posts are unavailable right now".

## C. Signed in with the production Clerk instance

Status: working end to end on 2026-10-13 (sign-in, comment write, CORS preflight 204).

Command list only: [`README.md` "How to run from scratch for local dev"](./README.md#how-to-run-from-scratch-for-local-dev). This section explains each step.

### How it works

The goal: the browser must treat the Mac as a real HTTPS site under `prettylog.com`.

```text
browser: https://local.prettylog.com
   │ ① name → address   /etc/hosts: local.prettylog.com = 127.0.0.1  (the Mac, not public DNS)
   │ ② port 443         the https default, so the URL has no port
   │                     → Origin = https://local.prettylog.com   (what Clerk accepts)
   │ ③ TLS              certificate for local.prettylog.com, signed by a Mac-only CA (mkcert)
   ▼                     → the browser trusts the connection
next dev  (0.0.0.0:443, --experimental-https)
   │ SSR fetch, and browser calls with the Clerk token
   ▼
https://blog-api.prettylog.com   checks: token from the production instance ✅
                                         azp listed in ALLOWED_ORIGINS ✅
```

| Piece | What it does | Why |
| --- | --- | --- |
| ① `/etc/hosts` | sends `local.prettylog.com` to `127.0.0.1` | Clerk production keys work only on `prettylog.com` and its subdomains |
| ② port `443` | keeps the port out of the origin | Clerk rejected `https://local.prettylog.com:3000`: "The Request HTTP Origin header must be equal to or a subdomain of the requesting URL" (seen 2026-10-13) |
| ②′ `-H 0.0.0.0` | listens on all addresses | macOS lets a normal user bind a port below 1024 only on `0.0.0.0`; `127.0.0.1:443` fails with `EACCES` |
| ③ mkcert certificate | a local CA in the Keychain signs a certificate that names `local.prettylog.com` | Clerk needs HTTPS (its cookies are `Secure`). Next's own `--experimental-https` certificate names only `localhost`, `127.0.0.1`, `::1`, `0.0.0.0` |
| `allowedDevOrigins` | `next.config.ts` lists `local.prettylog.com` | without it the dev server blocks hot reload (HMR) from that host. Dev only, no effect on the prod build |

### 1. Point `local.prettylog.com` at the Mac (once)

```sh
echo '127.0.0.1 local.prettylog.com' | sudo tee -a /etc/hosts
```

Never create a public DNS record (or a `*` wildcard) for this name in Cloudflare.

### 2. Allow the origin on the prod API (VM, once)

```sh
grep '^ALLOWED_ORIGINS' ~/prettylog/shared/api.env
# must be: ALLOWED_ORIGINS=https://my.prettylog.com,https://local.prettylog.com
vi ~/prettylog/shared/api.env                       # fix it if different
pm2 restart ~/prettylog/ecosystem.config.cjs --only blog-api --update-env
pm2 env $(pm2 id blog-api | tr -dc '0-9') | grep ALLOWED_ORIGINS   # the running value
```

- No port: the browser sends `https://local.prettylog.com` as the origin on 443.
- No quotes, spaces or trailing `/` in the value.
- Use the full ecosystem path. A bare `ecosystem` works only inside `~/prettylog`; elsewhere
  PM2 says `Process or Namespace ecosystem not found` (seen 2026-10-13).
- `--update-env` makes PM2 re-read `api.env`. Without it the old value stays.

Check from the Mac. The CORS preflight must answer `204` with the origin echoed back:

```sh
curl -s -o /dev/null -D - -X OPTIONS https://blog-api.prettylog.com/v1/api/users/me \
  -H 'Origin: https://local.prettylog.com' -H 'Access-Control-Request-Method: GET' \
  | grep -iE '^HTTP|access-control-allow-origin'
# HTTP/2 204
# access-control-allow-origin: https://local.prettylog.com
```

A `500` without CORS headers means the origin is not in the running value yet.

### 3. Make the certificate (Mac, once)

mkcert is downloaded by Next on its first `--experimental-https` run, into
`~/Library/Caches/mkcert/`. That first run also creates the local CA and adds it to the
Keychain (it asks for the Mac password). Run it once if the folder is empty, then stop it:

```sh
cd ~/Documents/00_projects/project_tradelunch/apps/dashboard_client_web
ls ~/Library/Caches/mkcert/ 2>/dev/null || pnpm exec next dev -p 3000 --experimental-https   # Ctrl+C once "Ready"
```

Then make a certificate that names the host:

```sh
MKCERT=$(ls ~/Library/Caches/mkcert/mkcert-* | head -1)
mkdir -p certificates
"$MKCERT" -key-file certificates/local-key.pem -cert-file certificates/local.pem \
  local.prettylog.com localhost 127.0.0.1
openssl x509 -in certificates/local.pem -noout -ext subjectAltName   # must list DNS:local.prettylog.com
```

- `certificates/` is in this app's `.gitignore`. Never commit it.
- The certificate lasts about two years. Make it again with the same command when it expires.
- `brew install mkcert` + `mkcert -install` works too, in place of Next's copy.

### 4. Run the dev server with production keys (Mac)

```sh
cd ~/Documents/00_projects/project_tradelunch/apps/dashboard_client_web
read -s 'PK?pk_live: ' && echo && read -s 'SK?sk_live: ' && echo

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$PK CLERK_SECRET_KEY=$SK \
NEXT_PUBLIC_API_BASE=https://blog-api.prettylog.com \
pnpm exec next dev --turbopack -p 443 -H 0.0.0.0 --experimental-https \
  --experimental-https-key certificates/local-key.pem \
  --experimental-https-cert certificates/local.pem
```

- `read -s` keeps the keys off the screen and out of shell history.
- Both key variables are required. Without them the dev keys in `.env.local` load and every
  signed-in call returns 401 again.
- Run `next` from `apps/dashboard_client_web` (or with `pnpm --filter dashboard_client_web exec`):
  it is not installed at the repo root (`Command "next" not found`).
- `0.0.0.0` also accepts connections from other devices on the same network. Stop the server
  (`Ctrl+C`) when the test is done.

### 5. Check

Open `https://local.prettylog.com` (no port), sign in, write a comment.

| Symptom | Cause | Fix |
| --- | --- | --- |
| `listen EACCES ... 127.0.0.1:443` | `-H local.prettylog.com` binds one address | use `-H 0.0.0.0` (step 4) |
| browser certificate warning (`ERR_CERT_COMMON_NAME_INVALID`) | Next's default certificate, without `local.prettylog.com` | step 3, and pass both `--experimental-https-*` flags |
| Clerk: "Production Keys are only allowed for domain" / Origin error | the URL has a port, or the host is not under `prettylog.com` | open `https://local.prettylog.com` on 443 |
| 401 `unauthorized` | dev keys loaded, or the origin is missing in `ALLOWED_ORIGINS` | step 4 variables; step 2 value and restart |
| CORS error in the browser console (preflight `500`) | origin not in the running `ALLOWED_ORIGINS` | step 2 value, restart with the full path and `--update-env`, re-run the preflight check |
| `[PM2][ERROR] Process or Namespace ecosystem not found` | bare `ecosystem` run outside `~/prettylog` | `pm2 restart ~/prettylog/ecosystem.config.cjs --only blog-api --update-env` |
| `Blocked cross-origin request ... /_next/webpack-hmr` | `allowedDevOrigins` missing | it is in `next.config.ts`; restart the dev server |

### Cautions

- Mode C writes to the **production** database. Test comments are public; delete them after
  the test (soft delete).
- Undo: remove `https://local.prettylog.com` from `ALLOWED_ORIGINS` and restart `blog-api`,
  then remove the line from `/etc/hosts`. The local CA stays in the Keychain;
  `"$MKCERT" -uninstall` removes it.
