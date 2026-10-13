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

Apply: copy and restart as in the "Ops Agent → Cloud Logging" section above, using the new `ops-agent.yaml` (it now has both pipelines).
Then build and deploy the web app, so the new `proxy.ts` runs.

Logs Explorer queries:

```text
# all web requests
log_id("blog-web") jsonPayload.message="request"

# page loads only, then group by jsonPayload.path or jsonPayload.country in the histogram / log fields panel
log_id("blog-web") jsonPayload.message="request" jsonPayload.rsc=false

# bots
log_id("blog-web") jsonPayload.ua=~"(?i)bot|crawler|spider"
```

---

## Look at logs on the VM

```sh
pm2 logs blog-api --lines 100 --nostream        # last lines, both streams
pm2 logs blog-api --err --lines 50 --nostream   # errors only
tail -f ~/.pm2/logs/blog-api-out-0.log
zcat ~/.pm2/logs/blog-api-out-0.log-*.gz | grep ' 500 '   # rotated files
```
