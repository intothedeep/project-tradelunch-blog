# Incident: `blog-web` proxies to itself (2026-10-13)

Status: **resolved 2026-10-13.** `HOSTNAME: 'localhost'` in `ecosystem.config.cjs`, verified on the VM and from outside.

## Symptom

| Where | What |
| --- | --- |
| `https://my.prettylog.com` (first deploy) | `502` / no answer |
| VM `curl -m 20 http://127.0.0.1:3000/` | `000` after 20 s (hang), or `000` at once (refused), once `500` |
| VM `curl http://127.0.0.1:3000/robots.txt` | `200` in 0.25 s (no middleware on that path) |
| `pm2 logs blog-web --err` via the tunnel | `Failed to proxy https://localhost:3000/ Error: write EPROTO ... wrong version number` |
| `pm2 logs blog-web --err` via local curl | `Failed to proxy http://localhost:3000/ Error: connect ECONNREFUSED 127.0.0.1:3000` |
| Express (`blog-api`), memory | fine: `/ping` 200 public and local; 475 MiB available |

## Cause

```text
request ─► Next router         own origin  = <proto>://127.0.0.1:3000   (from HOSTNAME=127.0.0.1)
              │
              ├─► middleware   request URL = <proto>://localhost:3000     (Next default host)
              │       │
              │       └─ Clerk clerkMiddleware: on every NextResponse.next() it sets
              │          x-middleware-rewrite = request URL  (to pass auth headers)
              ▼
         Next router: rewrite origin (localhost) ≠ own origin (127.0.0.1)
              → "external rewrite" → HTTP proxy to <proto>://localhost:3000
              → fails: EPROTO when <proto> = https (X-Forwarded-Proto from cloudflared),
                       ECONNREFUSED / hang when <proto> = http
```

| Step | Source (Next 16.2.9, `@clerk/nextjs` 7.5.9) |
| --- | --- |
| Router origin = `protocol://` + `formatHostname(opts.hostname)` + port | `next/dist/server/lib/router-utils/resolve-routes.js:117` |
| `protocol` = `https` when `X-Forwarded-Proto` contains `https` | same file, line 115 |
| Middleware URL = `initProtocol://` + `(this.fetchHostname \|\| 'localhost')` + port | `next/dist/server/next-server.js:1132` |
| Different origin → kept absolute → proxied | `next/dist/shared/lib/router/utils/relativize-url.js` (`parseRelativeURL`) |
| Clerk turns `next()` into a same-URL rewrite | `@clerk/nextjs/dist/esm/server/utils.js:44-67` (`decorateRequest`) |

Only paths in the middleware matcher (`proxy.ts`) hit it. `/robots.txt`, `/_next/*` and files
with an extension do not, which is why they worked.

Not proven: that `fetchHostname` is empty in the standalone server. The log (`localhost` in the
proxied URL while HOSTNAME was `127.0.0.1`) is the evidence.

## Fix

`deploy/gcp/ecosystem.config.cjs`, app `blog-web`:

```diff
-                HOSTNAME: '127.0.0.1',
+                HOSTNAME: 'localhost',
```

Both origins become `<proto>://localhost:3000`, so the rewrite stays internal. `localhost`
resolves to `127.0.0.1` on the VM, so the server still listens on loopback only.

Apply (no rebuild):

```sh
# Mac, repo root
gcloud compute scp deploy/gcp/ecosystem.config.cjs $VM:~/prettylog/ "${Z[@]}"
# VM
pm2 restart ~/prettylog/ecosystem.config.cjs --only blog-web --update-env
pm2 env $(pm2 id blog-web | tr -dc '0-9') | grep HOSTNAME     # HOSTNAME: localhost
getent ahosts localhost | head -2                             # 127.0.0.1 first
ss -ltnp | grep ':3000'                                       # 127.0.0.1:3000, not 0.0.0.0
```

Rejected:

| Option | Why not |
| --- | --- |
| `HOSTNAME=0.0.0.0` | Next maps it to `localhost` too, but listens on every interface; only the GCP firewall would protect `:3000` |
| `skipProxyUrlNormalize` in `next.config.ts` | needs a rebuild and changes how middleware sees the URL; kept as the fallback |
| Cloudflare tunnel "HTTP Host Header" | the Host header is not used for either origin, so it does not help |

## Verified (2026-10-13)

| Check | Result |
| --- | --- |
| `pm2 env … \| grep HOSTNAME` | `HOSTNAME: localhost` |
| `getent ahosts localhost` | `127.0.0.1` first |
| `ss -ltnp \| grep :3000` | `127.0.0.1:3000` (loopback only) |
| VM `curl http://127.0.0.1:3000/` ×3 | `200` in 1.49 s, 0.51 s, 0.35 s |
| `pm2 logs blog-web --err \| grep -c 'Failed to proxy'` | `0` |
| Mac `https://my.prettylog.com` `/`, `/blog`, a post, `/about` | all `200` (0.7–1.9 s) |

A `500 Internal Server Error` seen from outside during the change came from the old process; it
was gone after `pm2 restart ~/prettylog/ecosystem.config.cjs --only blog-web --update-env`.
`pm2 save` stored the new process list.
