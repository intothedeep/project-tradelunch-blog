# 1. `blog-web` proxies to itself

Result: fixed 2026-10-13. Commit `3a6463a`, file `deploy/gcp/ecosystem.config.cjs`, full write-up `deploy/gcp/web-self-proxy.md`.

## Symptom

| Where | What |
| --- | --- |
| `https://my.prettylog.com` (first deploy) | `502` or no answer |
| VM `curl -m 20 http://127.0.0.1:3000/` | `000` after 20 s (hang), or `000` at once (refused), once `500` |
| VM `curl http://127.0.0.1:3000/robots.txt` | `200` in 0.25 s |
| `pm2 logs blog-web --err`, via the tunnel | `Failed to proxy https://localhost:3000/ Error: write EPROTO ... wrong version number` |
| `pm2 logs blog-web --err`, via local curl | `Failed to proxy http://localhost:3000/ Error: connect ECONNREFUSED 127.0.0.1:3000` |
| `blog-api` | fine. `/ping` 200 public and local, 475 MiB available |

## Cause

```text
request ─► Next router      own origin   = <proto>://127.0.0.1:3000   (HOSTNAME=127.0.0.1)
              │
              ├─► middleware  request URL = <proto>://localhost:3000   (Next default host)
              │      └─ Clerk sets x-middleware-rewrite = request URL on every next()
              ▼
        origins differ (localhost vs 127.0.0.1)
              → treated as an external rewrite → HTTP proxy to itself
              → EPROTO when <proto> is https, ECONNREFUSED or hang when http
```

- Only paths in the middleware matcher (`proxy.ts`) hit it. `/robots.txt` and `/_next/*` skip it.
- `<proto>` is `https` when cloudflared sends `X-Forwarded-Proto: https`.
- Not proven: that `fetchHostname` is empty in the standalone server. The log is the evidence.

First wrong hypothesis: the Host header from cloudflared caused it.
Dropped, because a plain `curl` with no headers also failed.

## Fix

```diff
-                HOSTNAME: '127.0.0.1',
+                HOSTNAME: 'localhost',
```

Both origins become `<proto>://localhost:3000`, so the rewrite stays internal.
`localhost` resolves to `127.0.0.1`, so the bind stays on loopback.

```sh
# Mac
gcloud compute scp deploy/gcp/ecosystem.config.cjs $VM:~/prettylog/ "${Z[@]}"
# VM
pm2 restart ~/prettylog/ecosystem.config.cjs --only blog-web --update-env
pm2 env $(pm2 id blog-web | tr -dc '0-9') | grep HOSTNAME
ss -ltnp | grep ':3000'
```

Rejected: `HOSTNAME=0.0.0.0` (listens on every interface), `skipProxyUrlNormalize` (needs a rebuild, kept as fallback), Cloudflare "HTTP Host Header" (Host is used by neither origin).

## Evidence

| Check | Result |
| --- | --- |
| Router origin built from `HOSTNAME` | `next/dist/server/lib/router-utils/resolve-routes.js:117` (Next 16.2.9) |
| `https` when `X-Forwarded-Proto` has `https` | same file, line 115 |
| Middleware URL uses `(this.fetchHostname \|\| 'localhost')` | `next/dist/server/next-server.js:1132` |
| Clerk turns `next()` into a same-URL rewrite | `@clerk/nextjs/dist/esm/server/utils.js:44-67` (7.5.9) |
| `pm2 env` | `HOSTNAME: localhost` |
| `ss -ltnp` | `127.0.0.1:3000` |
| VM page, 3 runs | `200` in 1.49 s, 0.51 s, 0.35 s |
| `grep -c 'Failed to proxy'` | `0` |
| Outside: `/`, `/blog`, a post, `/about` | all `200` (0.7 to 1.9 s) |

A `500` seen from outside during the change came from the old process and was gone after the restart.

## Lesson

Compare `/` with `/robots.txt` first. A split like that points at the middleware in one step.
