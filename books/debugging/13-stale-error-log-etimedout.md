# 13. pm2 error log shows `ETIMEDOUT` after a release, but the errors are old

Result: nothing to fix (2026-10-13). All 724 log lines were old. The cause of the old 20:57 UTC timeouts is not known.

## Symptom

`pm2 logs blog-web --err --lines 40 --nostream`, file `~/.pm2/logs/blog-web-error-3.log`:

```text
[RecentPostsList] feed fetch failed: fetch failed
⨯ [TypeError: fetch failed] { digest: '3227098399', [cause]: AggregateError: { code: 'ETIMEDOUT', [errors]: [ [Error], [Error], [Error], [Error] ] } }
⨯ Error [TimeoutError]: The operation was aborted due to timeout { digest: '3827087268', code: 23, ... }
```

## Cause

Question: is the `ETIMEDOUT` a current error or an old one?

```text
blog-web SSR ─► https://blog-api.prettylog.com ─► Cloudflare ─► Tunnel ─► blog-api :4000
(http.server.ts:64)
 check: page      check: v4 / v6 (public)                                 check: local
```

- `apps/dashboard_client_web/apis/http.server.ts:64` calls `fetch(${API_BASE}${path})`. The VM calls its own API through the public domain.
- `AggregateError` with 4 errors: likely one per resolved address of `blog-api.prettylog.com` (2 IPv4 and 2 IPv6 Cloudflare addresses). Interpretation, not verified.
- Trap: `pm2 logs --lines 40` prints the last 40 lines of a file with no timestamps. It cannot tell old errors from new ones.

## Fix

No fix. Check on the VM instead:

```sh
L=~/.pm2/logs/blog-web-error-3.log
ls -l --time-style=full-iso $L
wc -l $L
curl -m 20 -s -o /dev/null -w 'page %{http_code} %{time_total}s\n' http://localhost:3000/
wc -l $L
curl -4 -m 10 -s -o /dev/null -w 'v4 %{http_code} %{time_total}s\n' https://blog-api.prettylog.com/ping
curl -6 -m 10 -s -o /dev/null -w 'v6 %{http_code} %{time_total}s\n' https://blog-api.prettylog.com/ping
curl -m 5 -s -o /dev/null -w 'local %{http_code}\n' http://127.0.0.1:4000/ping
pm2 ls
```

Owner's output:

| Command | Output |
| --- | --- |
| `ls -l --time-style=full-iso $L` | `2026-10-13 20:57:17.958 +0000`, 20646 bytes |
| `wc -l $L` | 724 |
| `curl ... http://localhost:3000/` | `page 200 0.580770s` |
| `wc -l $L` (after the request) | 724 (unchanged) |
| `curl -4 ... /ping` | `v4 200 0.201960s` |
| `curl -6 ... /ping` | `v6 000 0.001322s` |
| `curl ... http://127.0.0.1:4000/ping` | `local 200` |
| `pm2 ls` | `blog-api` online, uptime 2h, restarts 7. `blog-web` online, uptime 6m, restarts 8, 154.7mb |

How to read a result:

| Result | Meaning |
| --- | --- |
| line count unchanged, page 200 | old errors, this release is fine |
| v4 200, v6 000 | no IPv6 route, normally falls back to v4 |
| v4 000, local 200 | API alive, VM to Cloudflare egress blocked |
| local 000 | `blog-api` is down, read `pm2 logs blog-api --err` |
| failures only sometimes | transient, compare with the #70 429 time window |

Verdict:

- All 724 lines are old.
- The last write, 20:57:17 UTC, is before the build of `4011c84` (run created 23:19:45 UTC), so before the release.
- A fresh request added 0 lines.
- `v6 000` in 0.001 s is an immediate failure (no IPv6 route on the GCP VM), not a timeout.
- v4, the local API and SSR all work.
- The cause of the old 20:57 UTC timeouts is not determined. Do not guess.

## Evidence

- File mtime `2026-10-13 20:57:17.958 +0000` and 724 lines before and after one request (table above).
- `page 200`, `v4 200`, `local 200` in the same session.
- Run for `4011c84` created 23:19:45 UTC.

Not verified: that the 4 errors are 2 IPv4 and 2 IPv6 addresses. Why the old timeouts happened.

Follow-up (2026-10-13):

- PM2 `log_date_format` was rejected. It prefixes every line with a date, so the Ops Agent `parse_json` fails on every JSON line.
- Commit `35b3630` turns the time-less error lines into JSON lines with `time`. It is pushed, not yet deployed to the VM.
- The JSON error line is not observed in real output yet.
- After deploy, this query replaces the `ls -l` / `wc -l` workaround. Empty = no errors in the last hour. Times before the release = old errors.

```sh
gcloud logging read 'LOG_ID("blog-web") AND severity>=WARNING' --freshness=1h --limit 20 --format='value(timestamp, jsonPayload.message, jsonPayload.cause.code)'
```

- Details: `deploy/logging/README.md` "Timestamped JSON error lines" and book chapter 06, `sec:06-errorjson`.

## Lesson

1. A log tail without timestamps is not evidence of a current failure. Check the file mtime and the line count before and after one request.
2. Split the path: SSR page, public API v4 and v6, local API. Give each hop one `curl` with a timeout.
3. `curl -6` failing in about 1 ms means "no route", not "slow".
