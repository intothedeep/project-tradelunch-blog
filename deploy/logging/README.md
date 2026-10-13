# API server logging — `blog-api` on the GCP VM

Decision: `decisions.plan.md` #55 (owner, 2026-10-13): **① → ⓐ → ②, in that order.**
Consequence: the GCP Ops Agent stays on (O18 = keep).

```text
blog-api (Express)
  │  ⓐ pino: one JSON line per request / error  → stdout / stderr
  ▼
PM2 log files   ~/.pm2/logs/blog-api-out-0.log, blog-api-error-0.log
  │  ① rotated daily or at 10 MB, 14 kept, gzip
  ▼
② Google Cloud Ops Agent (fluent-bit, already running as root)
  │  tails the PM2 files, parses JSON
  ▼
Cloud Logging   (GCP console → Logging → Logs Explorer)
```

| Step | What | Status |
| --- | --- | --- |
| ① | Rotate the PM2 log files so they never fill the 30 GB disk | **done 2026-10-13** — Ubuntu `logrotate` (#56) |
| ⓐ | Structured JSON request logs in Express (pino) | code done 2026-10-13 (`src/lib/logger.ts`), **not deployed yet** |
| ② | Ship the PM2 files to Cloud Logging with the Ops Agent | todo — after ⓐ is deployed; config = `ops-agent.yaml` here |

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
    rotate 14
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
| `rotate 14` · `compress` · `delaycompress` | keep 14 old files; gzip all but the newest old one |
| `copytruncate` | PM2 holds the file open; copy then truncate in place (a few lines can be lost in that instant) |

Check:

```sh
sudo logrotate -d /etc/logrotate.d/pm2-tio_taek_lim   # dry run, no change
systemctl list-timers logrotate.timer                  # next run (00:00 UTC)
ls -la ~/.pm2/logs/                                     # rotated: blog-api-out-0.log-YYYYMMDD(.gz)
```

Removed: `pm2 uninstall pm2-logrotate` + `pm2 save`. Its two empty log files were renamed `x_*`.
---

## ⓐ Structured request logs (pino) — code done, not deployed

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

## ② Ops Agent → Cloud Logging — todo (after ⓐ)

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

## Look at logs today (before ②)

```sh
pm2 logs blog-api --lines 100 --nostream        # last lines, both streams
pm2 logs blog-api --err --lines 50 --nostream   # errors only
tail -f ~/.pm2/logs/blog-api-out-0.log
zcat ~/.pm2/logs/blog-api-out-0.log-*.gz | grep ' 500 '   # rotated files
```
