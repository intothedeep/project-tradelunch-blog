# 6. `listen EACCES` on port 443

Result: fixed 2026-10-13 with `-H 0.0.0.0`. Documented in `apps/dashboard_client_web/LOCAL_PROD_API.md` step 4.

## Symptom

| Where | What |
| --- | --- |
| Command | `next dev -p 443 -H local.prettylog.com ...` |
| Error | `listen EACCES: permission denied 127.0.0.1:443` |

## Cause

```text
-H local.prettylog.com ─► resolves to 127.0.0.1 ─► bind 127.0.0.1:443 ─► EACCES
-H 0.0.0.0             ─►                          bind 0.0.0.0:443   ─► ok (normal user)
```

- Observed: a normal user binds `0.0.0.0:443` on this Mac, but not `127.0.0.1:443`.
- The runbook states the rule as macOS behavior. Why macOS differs is not verified here.

## Fix

```sh
pnpm exec next dev --turbopack -p 443 -H 0.0.0.0 --experimental-https ...
```

Caution: `0.0.0.0` accepts connections from other devices on the same network.
Stop the server with `Ctrl+C` when the test ends.

## Evidence

- `LOCAL_PROD_API.md` table row for `-H 0.0.0.0`.
- Check-table row: `listen EACCES ... 127.0.0.1:443` with fix `-H 0.0.0.0`.

## Lesson

A host name picks the bind address. Name the address yourself when a permission error mentions one.
