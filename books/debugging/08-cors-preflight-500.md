# 8. CORS preflight returns 500 and the PM2 restart misses

Result: fixed 2026-10-13. Full ecosystem path plus `--update-env`. Documented in `apps/dashboard_client_web/LOCAL_PROD_API.md` step 2 and `deploy/gcp/README.md` troubleshooting.

## Symptom

| Where | What |
| --- | --- |
| Preflight `OPTIONS`, Origin `https://local.prettylog.com` | 500, no CORS headers (until the origin was in the running list) |
| Preflight, Origin `https://my.prettylog.com` | 204 |
| `pm2 restart ecosystem --only blog-api --update-env` in `~/prettylog/shared` | `[PM2][ERROR] Process or Namespace ecosystem not found` |
| Browser console | CORS error |

## Cause

```text
edit shared/api.env ──► pm2 restart ecosystem ... (cwd = ~/prettylog/shared)
                          └─ "ecosystem" not found ─► NOTHING restarted
                                                      └─ old ALLOWED_ORIGINS still running
OPTIONS from local.prettylog.com ─► origin not in running list ─► 500, no CORS headers
```

- A bare `ecosystem` resolves only inside `~/prettylog`.
- The file on disk was right. The running process held the old value.

## Fix

```sh
pm2 restart ~/prettylog/ecosystem.config.cjs --only blog-api --update-env
pm2 env $(pm2 id blog-api | tr -dc '0-9') | grep ALLOWED_ORIGINS
```

Check from the Mac. Expect `HTTP/2 204` and the origin echoed:

```sh
curl -s -o /dev/null -D - -X OPTIONS https://blog-api.prettylog.com/v1/api/users/me \
  -H 'Origin: https://local.prettylog.com' -H 'Access-Control-Request-Method: GET' \
  | grep -iE '^HTTP|access-control-allow-origin'
```

Final value (from `pm2 env` on the VM, 2026-10-13): `https://local.prettylog.com,https://my.prettylog.com`.
Removed: `http://localhost:3000` and `https://taeklim-blog-client.vercel.app`. A preflight for `localhost:3000` now returns 500.

Side note (from the brief): an unlisted origin gets 500, not 403, and Cloud Logging counts it as ERROR. A change to 403 was offered and not done.

## Evidence

- `LOCAL_PROD_API.md` step 2: "A `500` without CORS headers means the origin is not in the running value yet."
- `deploy/gcp/README.md` troubleshooting row for `Process or Namespace ecosystem not found`.

## Lesson

Verify the running value with `pm2 env`. An edited file proves nothing about the process.
