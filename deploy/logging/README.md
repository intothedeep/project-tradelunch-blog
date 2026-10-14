# API server logging — `blog-api` on the GCP VM

Decision: `decisions.plan.md` #55 (owner, 2026-10-13): **① → ⓐ → ②, in that order.**
Consequence: the GCP Ops Agent stays on (O18 = keep).

```text
blog-api (Express)
  │  ⓐ pino: one JSON line per request / error  → stdout / stderr
  ▼
PM2 log files   ~/.pm2/logs/blog-api-out-0.log, blog-api-error-0.log
  │  ① rotated daily or at 10 MB, 7 kept (7 days), gzip
  ▼
② Google Cloud Ops Agent (fluent-bit, already running as root)
  │  tails the PM2 files, parses JSON
  ▼
Cloud Logging   (GCP console → Logging → Logs Explorer)
```

| Step | What | Status |
| --- | --- | --- |
| ① | Rotate the PM2 log files so they never fill the 30 GB disk | **done 2026-10-13** — Ubuntu `logrotate` (#56) |
| ⓐ | Structured JSON request logs in Express (pino) | **done 2026-10-13** — deployed `be590a6` |
| ② | Ship the PM2 files to Cloud Logging with the Ops Agent | **done 2026-10-13** — `ops-agent.yaml` applied; severity mapped |

---

## ① Log rotation — done (Ubuntu `logrotate`, decision #56)

First tried the `pm2-logrotate` module: it is its own Node process and used **73 MB** resident
(measured 2026-10-13) on a 953 MB VM. Replaced the same day with Ubuntu's built-in `logrotate`,
which runs once a day from `logrotate.timer` and uses 0 MB between runs.

On the VM, `/etc/logrotate.d/pm2-tio_taek_lim`:

```text
# PM2 app logs (decision #56). PM2 keeps the files open -> copytruncate.
/home/tio_taek_lim/.pm2/logs/*.log {
    su tio_taek_lim sudo
    daily
    maxsize 10M
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    dateext
}
```

| Line | Why |
| --- | --- |
| `su tio_taek_lim sudo` | `~/.pm2/logs` is group-writable; logrotate refuses such dirs unless told which user/group to act as |
| `daily` + `maxsize 10M` | rotate every day, or earlier at the daily run if a file passed 10 MB |
| `rotate 7` · `compress` · `delaycompress` | keep 7 old files (7 days on the VM, decision #59; Cloud Logging keeps 30); gzip all but the newest old one |
| `copytruncate` | PM2 holds the file open; copy then truncate in place (a few lines can be lost in that instant) |

Check:

```sh
sudo logrotate -d /etc/logrotate.d/pm2-tio_taek_lim   # dry run, no change
systemctl list-timers logrotate.timer                  # next run (00:00 UTC)
ls -la ~/.pm2/logs/                                     # rotated: blog-api-out-0.log-YYYYMMDD(.gz)
```

Removed: `pm2 uninstall pm2-logrotate` + `pm2 save`. Its two empty log files were renamed `x_*`.
---

## ⓐ Structured request logs (pino) — done (deployed 2026-10-13, be590a6)

Goal: every request writes one JSON line, so Cloud Logging can filter by field
(`jsonPayload.res.statusCode >= 500`, `jsonPayload.responseTime > 1000`).

Shape (the code in `apps/dashboard_server/src/lib/logger.ts` + `src/server.ts` is the source):

- Logger: `pino` → stdout, level from `LOG_LEVEL` (default `info`).
- Request log: `pino-http` middleware: method, url, status, response time, request id.
- Redact: `Authorization`, `Cookie`, `Set-Cookie` headers — never log tokens.
- Skip `/ping` (health checks would drown the log).
- Error handler logs the error with the request id at level `error`.
- Severity: pino level → Cloud Logging `severity` (`error` shows red in the console).

No secrets in logs. No log line contains a request body.

---

## ② Ops Agent → Cloud Logging — done (applied 2026-10-13)

The Ops Agent is already installed and running (`google-cloud-ops-agent*` services). It only
needs to know where the PM2 files are. Config file: `ops-agent.yaml` in this folder. It only ADDS a `blog-api` pipeline; the agent merges it with its built-in host-metrics and syslog defaults (the stock VM `config.yaml` is comments only).

Copy it up (Mac, repo root):

```sh
VM=tio_taek_lim@instance-servers
Z=(--zone=us-central1-a --tunnel-through-iap)
gcloud compute scp deploy/logging/ops-agent.yaml $VM:~/prettylog/ "${Z[@]}"
```

Apply on the VM:

```sh
sudo cp /etc/google-cloud-ops-agent/config.yaml /etc/google-cloud-ops-agent/x_config.yaml.bak
sudo cp ~/prettylog/ops-agent.yaml /etc/google-cloud-ops-agent/config.yaml
sudo systemctl restart google-cloud-ops-agent
sudo systemctl status google-cloud-ops-agent-fluent-bit --no-pager | head -5
```

View: GCP console → **Logging → Logs Explorer**, query:

```text
resource.type="gce_instance"
log_id("blog-api")
jsonPayload.res.statusCode>=500
```

Cost: Cloud Logging has a monthly free ingestion allotment per project (understood as 50 GiB,
default retention 30 days — verify on the pricing page before relying on it). This app writes
far less. The allotment is part of the Always Free tier, not only the 90-day trial.

**Free trial note:** the 90-day / $300 trial ends around **2027-01-10** (owner: 89 days left on
2026-10-13). Before it ends, upgrade the billing account to a paid account, or GCP may stop the
VM. Always Free (e2-micro, logging allotment) keeps applying after the upgrade. Set a budget
alert first.

---

## Log views (blog-web, blog-api): done 2026-10-13

Purpose: read `blog-web` and `blog-api` apart in Logs Explorer, without one big pile of logs.
Done by the owner, checked with `gcloud logging views list`.

Layout: both logs sit in one bucket. A log view is a saved filter on that bucket.

```text
VM Instance (instance-servers)      resource type: same for both
  └─ _Default bucket (30 days)       storage: same for both
       ├─ LOG_ID("blog-api")   receiver blog-api in ops-agent.yaml
       ├─ LOG_ID("blog-web")   receiver blog-web
       ├─ LOG_ID("syslog")     Ops Agent default (noise)
       └─ LOG_ID("ops-agent-…")
```

Three levels of separation:

| Level | State | What it gives | Cost of it |
| --- | --- | --- | --- |
| Log name (`LOG_ID`) | already existed | filter by name in a query | none |
| Log view | **added now** | pick the log in the "Refine scope" menu | no extra cost, storage stays in `_Default` |
| Separate bucket + sink | not done | own retention, own access | needs a sink and a `_Default` exclusion |

Chosen: log views. A separate bucket is worth it only for different retention or access.

Commands the owner ran (once):

```sh
P=$(gcloud config get-value project)
gcloud logging views create blog-web --bucket=_Default --location=global \
  --log-filter='LOG_ID("blog-web")' --description="Next.js blog-web" --project=$P
gcloud logging views create blog-api --bucket=_Default --location=global \
  --log-filter='LOG_ID("blog-api")' --description="Express blog-api" --project=$P
```

Verify (`gcloud logging views list --bucket=_Default --location=global`), output:

```text
VIEW_ID   FILTER                                                                                                          DESCRIPTION
_AllLogs                                                                                                                  Access to all logs
_Default  NOT LOG_ID("cloudaudit.googleapis.com/data_access") AND NOT LOG_ID("externalaudit.googleapis.com/data_access")  Access to all logs except data access logs
blog-api  LOG_ID("blog-api")                                                                                              Express blog-api
blog-web  LOG_ID("blog-web")                                                                                              Next.js blog-web
```

Use: Logs Explorer → **Refine scope** → log view → `blog-web` or `blog-api`.

---

## Timestamped JSON error lines (blog-web, commit `35b3630`)

Purpose: tell old errors from new ones. Status: committed and pushed 2026-10-13, **not yet deployed to the VM**.
The JSON error line below is **not observed** in real output yet.

Problem: `pm2 logs blog-web --err` showed error lines with no time (book case 13). Old and new could not be told apart.

Why not PM2 `log_date_format`:

- PM2 would prefix every line with a date, for example `2026-10-13T23:40:01: {"level":30,...}`.
- The Ops Agent `parse_json` (`ops-agent.yaml`) then fails on every pino and request JSON line.
- Cloud Logging would lose the structured fields, the severity mapping and the request-log queries (decisions #56, #58).

Fix: the JSON lines already carry `time`. Make the time-less lines JSON too. `ops-agent.yaml` is unchanged.

| Line | Before | Now |
| --- | --- | --- |
| blog-api pino (`apps/dashboard_server/src/lib/logger.ts:24`) | JSON with `time` | unchanged |
| blog-web request log (`apps/dashboard_client_web/proxy.ts:38`) | JSON with `time` | unchanged |
| plain `console.error` strings, e.g. `[RecentPostsList] feed fetch failed` | text, no time | JSON with `time` via `logServerError` |
| Next's own `⨯ [TypeError: fetch failed] { digest ... }` output | text, no time | still printed (Next internals); an extra JSON line comes from `onRequestError` |

Where (`apps/dashboard_client_web`):

- New `utils/serverLog.util.ts`: `toErrorLogLine(severity, message, err?, context?)` (pure) and `logServerError(message, err?, context?, severity='ERROR')`.
- `instrumentation.ts`: `onRequestError` first calls `logServerError('request error', err, {digest, path, method, routerKind, routePath, routeType})`, then does the existing POST to Express `/v1/api/error-logs`.
- `console.error` became `logServerError` in `apis/getPostsByTag.api.ts`, `getUserPopularTags.api.ts`, `getPosts.api.ts`, `getUserProfile.api.ts`, `getPopularTags.api.ts`, `getPost.api.ts` (ERROR, they rethrow) and in `app/sitemap.ts`, `app/blog/components/RecentPostsList.server.tsx` (WARNING, handled fallback).
- Client components (`error.tsx` files, `CategoryErrorboundary.client.tsx`, `useDraftAutosave.hook.ts`) are unchanged: they log in the browser.

Line keys: the context keys, then `time` (ISO), `severity` (`ERROR` or `WARNING`), `message`, `err{name,message,code}`, `cause{name,message,code}`.
The fixed keys come after the context keys, so context cannot overwrite them.
The line is not gated by `LOG_REQUESTS`.
`cause.code` carries the network code, e.g. `ETIMEDOUT` (undici wraps it: `TypeError: fetch failed` → cause `AggregateError` with code `ETIMEDOUT`).

Expected line (**inferred from the code, not observed**):

```json
{"username":"tio","time":"2026-10-13T09:12:03.411Z","severity":"WARNING","message":"[RecentPostsList] feed fetch failed","err":{"name":"TypeError","message":"fetch failed"},"cause":{"name":"AggregateError","message":"","code":"ETIMEDOUT"}}
```

Notes:

- Next's `⨯` multi-line output still appears. Next prints it and the code cannot change it.
- An error in an `apis/*.api.ts` file logs twice per request: its own line, and the `onRequestError` line.
- `digest` in the `onRequestError` line is the digest Next prints in its `⨯` line. It pairs the two. Not checked against real output yet.

Check after deploy (replaces the `ls -l` / `wc -l` workaround of book case 13):

```sh
gcloud logging read 'LOG_ID("blog-web") AND severity>=WARNING' --freshness=1h --limit 20 --format='value(timestamp, jsonPayload.message, jsonPayload.cause.code)'
```

| Result | Meaning |
| --- | --- |
| empty | no errors in the last hour |
| lines with a time before the release | old errors |

---

## Volume and noise — option C for now (decision #57)

Cloud Logging bills by **bytes ingested**, not by entry count. Retention: `_Default` bucket,
**30 days** (owner, 2026-10-13: keep 30 — retention up to 30 days costs nothing extra).

Measured 2026-10-13 (`check-volume.sh 1d`, a day with three Ops Agent restarts and a boot):

| Source | Entries | ≈ MB | What it is |
| --- | --- | --- | --- |
| `blog-api` | 421 | 0.2 | the API request / error log (what we want) |
| `syslog` | 5,007 | 3.4 | VM system log, collected by the Ops Agent by default |
| `ops-agent-*` | 1,361 | 0.7 | the agent's own logs |
| other | 146 | 0.2 | guest agent, OS Config, audit |

Top syslog senders that day: `systemd`, `kernel`, `sbkeysync` (Secure Boot keys at boot),
`google_cloud_ops_agent_engine` (config dump on each restart), `otelopscol`, `cloudflared`
(`ERR` on every `my.` request while Next is not running — goes away after the Next deploy).

About 4.5 MB/day → far below the monthly free allotment (understood as 50 GiB; verify on the pricing page).

### Options if it gets too noisy

| Option | How | Effect | Cost of it |
| --- | --- | --- | --- |
| **A** — stop shipping syslog | in `ops-agent.yaml` add `service.pipelines.default_pipeline: { receivers: [] }` | about 70 % fewer entries; usually only `blog-api` left | VM system logs (cloudflared, systemd) not in the console; still on the VM via `journalctl` |
| A′ — syslog for cloudflared only | a `files`/`systemd_journald` receiver filtered to `cloudflared` instead of all syslog | keeps tunnel errors in the console | one more receiver to maintain |
| **B** — Log Router exclusion | Console → Logging → Log Router → `_Default` sink → exclusion, e.g. `log_id("syslog") OR log_id("ops-agent-fluent-bit")` | not stored, not billed; agent unchanged | console setting, not in git |
| **C** — keep as is (**chosen**) | nothing | — | some noise; filter with `log_id("blog-api")` |

### Weekly review

```text
every Monday 14:17 UTC  GitHub Actions (logging-review.yml) opens an issue "Logging review <date>"
                            │  checklist + the command below
                            ▼
owner (or ask Claude)   deploy/logging/check-volume.sh 7d   (Mac, repo root, gcloud logged in)
                            │
                ┌───────────┴────────────┐
        still fine → close issue    too noisy → pick A / A′ / B above
```

The reminder needs no GCP credentials; the check runs where `gcloud` is logged in. Run it by
hand any time: `deploy/logging/check-volume.sh 7d` (or `30d`).

---

## Web request log (`blog-web`, decision #58)

Goal: see who hits the Next.js site (paths, countries, bots) in Logs Explorer.
`apps/dashboard_client_web/proxy.ts` writes one JSON line per request to stdout
(every environment, like blog-api). PM2 stores it in `~/.pm2/logs/blog-web-out-*.log`; the Ops Agent ships it.

| Field | Meaning |
| --- | --- |
| `severity`, `message`, `time` | always `INFO`, `request`, ISO time |
| `method`, `host`, `path`, `query` | request line; `host` is the public Host header |
| `ip` | **full** client IP: `cf-connecting-ip`, else first `x-forwarded-for`, else null |
| `country`, `ray` | `cf-ipcountry`, `cf-ray` |
| `ua`, `referer` | `user-agent`, `referer` |
| `rsc` | true for Next RSC navigation fetches (filter them apart from page loads) |
| `signedIn` | true if a `__session` cookie exists (the value is never logged) |

Example line (fake values):

```json
{"severity":"INFO","message":"request","time":"2026-10-13T09:30:00.000Z","method":"GET","host":"my.prettylog.com","path":"/posts/123","query":"","ip":"203.0.113.7","country":"KR","ray":"0000000000000000-ICN","ua":"Mozilla/5.0","referer":null,"rsc":false,"signedIn":false}
```

Local: the same lines print in the dev server terminal (`pnpm dev:web`).
Silence them with `LOG_REQUESTS=false pnpm dev:web`. Default is on.

Limits:

- IPs are full (owner, #58). They are personal data, kept 30 days (#57). Do not export them.
- Only Cloudflare MISSes reach the origin, so cached hits are not in this log.
- Static files outside the proxy matcher (`_next`, files with a dot) are not logged.
- Next's own startup lines (`▲ Next.js ...`) are not JSON and stay as text entries.

### Apply on the VM (once)

```text
1. deploy a web build ─► 2. logrotate 7 days ─► 3. Ops Agent config ─► 4. check
   (needs proxy.ts)       (independent)           (any order vs 1)       (after 1 and 3)
```

**1. Deploy a web build that has the new `proxy.ts`** (Mac, then VM)

Any green `GCP build` run at or after commit `f33a917` has it. Deploy it with
`deploy/gcp/README.md` section 8, steps a–e.

```sh
gh run list --workflow=gcp.yml --limit 3      # pick a "success" run at/after f33a917
```

**2. Keep VM log files 7 days** (VM, decision #59; independent of the other steps)

```sh
sudo sed -i 's/^    rotate 14$/    rotate 7/' /etc/logrotate.d/pm2-tio_taek_lim
grep rotate /etc/logrotate.d/pm2-tio_taek_lim         # rotate 7
sudo logrotate -d /etc/logrotate.d/pm2-tio_taek_lim   # dry run: no change, no "error" lines
```

The rule covers `~/.pm2/logs/*.log`, so the new `blog-web` files need no extra entry.
Existing files are not removed until there are more than 7 rotations.

**3. Ship `blog-web` with the Ops Agent** (copy on the Mac, apply on the VM)

```sh
# Mac, repo root
VM=tio_taek_lim@instance-servers
Z=(--zone=us-central1-a --tunnel-through-iap)
gcloud compute scp deploy/logging/ops-agent.yaml $VM:~/prettylog/ "${Z[@]}"

# VM
sudo cp /etc/google-cloud-ops-agent/config.yaml /etc/google-cloud-ops-agent/x_config.yaml.bak
sudo cp ~/prettylog/ops-agent.yaml /etc/google-cloud-ops-agent/config.yaml
sudo systemctl restart google-cloud-ops-agent
sudo systemctl status google-cloud-ops-agent-fluent-bit --no-pager | head -5   # active (running)
```

**4. Check** (after steps 1 and 3)

```sh
# VM: send one request, then look for the JSON line
curl -m 20 -s -o /dev/null http://localhost:3000/
tail -n 2 ~/.pm2/logs/blog-web-out-*.log     # {"severity":"INFO","message":"request",...}
```

Then GCP console → Logging → Logs Explorer:

```text
log_id("blog-web")
jsonPayload.message="request"
```

| Result | Meaning |
| --- | --- |
| JSON line in the VM file and the same line in Logs Explorer | done |
| line in the VM file, nothing in Logs Explorer | Ops Agent config: send `sudo journalctl -u google-cloud-ops-agent-fluent-bit -n 30` |
| no JSON line in the VM file | an old build is running: check the release sha (`readlink ~/prettylog/web/current`) against step 1 |
| entries arrive but `severity` is blank | the `blog_web_severity` processor is missing: re-copy `ops-agent.yaml` (step 3) |

Roll back step 3: `sudo cp /etc/google-cloud-ops-agent/x_config.yaml.bak /etc/google-cloud-ops-agent/config.yaml`
and restart the agent.

### Query the web log

Two places run the same filter language. Logs Explorer does not accept `#` comments
(use `--` if you need one), so paste only the filter lines.

**a. GCP console, Logs Explorer** (<https://console.cloud.google.com/logs/query?project=mywebsite-511502>)

1. Paste a filter into the **Query** box. Each line is ANDed.
2. Set the time range at the top (for example "Last 7 days").
3. Click **Run query**.
4. In **Log fields** (left), click `jsonPayload.path`, `jsonPayload.country` or `jsonPayload.ua`
   to see counts per value.

| Purpose | Filter |
| --- | --- |
| all web requests | `log_id("blog-web")` `jsonPayload.message="request"` |
| page loads only (no RSC navigation fetches) | `log_id("blog-web")` `jsonPayload.message="request"` `jsonPayload.rsc=false` |
| bots and link-preview fetchers | `log_id("blog-web")` `jsonPayload.ua=~"(?i)bot\|crawl\|spider\|externalhit\|slurp\|preview\|fetch"` |
| one path | `log_id("blog-web")` `jsonPayload.path="/blog"` |
| one country | `log_id("blog-web")` `jsonPayload.country="KR"` |
| signed-in visitors | `log_id("blog-web")` `jsonPayload.signedIn=true` |
| errors and warnings (after `35b3630` is deployed) | `log_id("blog-web")` `severity>=WARNING` |

Page loads only, as pasted into the Query box:

```text
log_id("blog-web")
jsonPayload.message="request"
jsonPayload.rsc=false
```

**b. Mac terminal** (`gcloud` logged in; join the conditions with `AND` on one line)

```sh
# page loads, last day
gcloud logging read 'log_id("blog-web") AND jsonPayload.message="request" AND jsonPayload.rsc=false' \
  --project=mywebsite-511502 --freshness=1d --limit=20 \
  --format='table(timestamp,jsonPayload.path,jsonPayload.country,jsonPayload.ua)'

# bots and link-preview fetchers, last day
gcloud logging read 'log_id("blog-web") AND jsonPayload.ua=~"(?i)bot|crawl|spider|externalhit|slurp|preview|fetch"' \
  --project=mywebsite-511502 --freshness=1d --limit=20 \
  --format='table(timestamp,jsonPayload.path,jsonPayload.ua)'

# errors and warnings, last hour (after 35b3630 is deployed; empty = none)
gcloud logging read 'LOG_ID("blog-web") AND severity>=WARNING' --freshness=1h --limit 20 \
  --format='value(timestamp, jsonPayload.message, jsonPayload.cause.code)'

# top paths, last 7 days (counts)
gcloud logging read 'log_id("blog-web") AND jsonPayload.message="request" AND jsonPayload.rsc=false' \
  --project=mywebsite-511502 --freshness=7d --limit=5000 --format='value(jsonPayload.path)' \
  | sort | uniq -c | sort -rn | head -20
```

- `--freshness` is the time range (`1h`, `1d`, `7d`). `--limit` caps the rows read.
- An empty result prints nothing (no header). That means no match, not an error.
- `jsonPayload.ip` is left out on purpose. Add it only for your own analysis. Never paste IPs
  into a GitHub issue: the repo is public.
- Bot pattern note: `facebookexternalhit` (Facebook link previews) has no "bot" in its UA, so
  the pattern also lists `externalhit` (seen 2026-10-13).
