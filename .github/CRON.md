# Scheduled Jobs (Cron) — tradelunch

Single reference for everything that runs on a schedule, **where** it runs, **how
often**, and the commands to run/inspect it. Two schedulers are in use:

1. **GitHub Actions** — all collector batch jobs + keepalives + CI. (Python/uv,
   needs DB + Storage + network → can't be pg_cron.)
2. **Supabase `pg_cron`** — pure-SQL housekeeping that lives *inside* Postgres.

All times are **UTC**. Cron format: `min hour day-of-month month day-of-week`.

---

## 1. GitHub Actions (`.github/workflows/`)

| Workflow | Cron (UTC) | Human cadence | What it does |
|---|---|---|---|
| `collector-daily.yml` | `30 21 * * 1-5` | Mon–Fri 21:30 | Yahoo daily OHLC ingest → `market_history` + `market_snapshots`; writes Parquet archive + uploads to Storage (when `COLLECTOR_ARCHIVE_PARQUET=1`). |
| `collector-weekly.yml` | `0 6 * * 0` | Sun 06:00 | Market-cap ranking → `tracked_symbols` (sticky universe) + `market_rankings`. |
| `collector-monthly.yml` | `0 7 1 * *` | 1st 07:00 | SEC EDGAR 13F holdings → `sec_filings` + `sec_holdings`. |
| `collector-prune.yml` | `0 7 30 12 *` | Dec 30 07:00 | **Phase M** `market_history` 5yr retention prune. **Scheduled run is ALWAYS dry-run.** |
| `collector-keepalive.yml` | `0 12 1,15 * *` | 1st & 15th 12:00 | Collector keepalive ping. |
| `supabase-keepalive.yml` | `0 9 * * 1,4` | Mon & Thu 09:00 | DB write ping so Supabase free tier doesn't auto-pause (~7-day idle). |
| `collector-seed-archive.yml` | — (manual) | `workflow_dispatch` only | One-shot FULL-history Parquet seed (inception via `fetch_full`) + Storage upload. Run after adding tickers. |
| `ci.yml` | — | on push / PR | Build + typecheck + lint + tests. |

### Run / inspect (terminal, `gh` CLI)

```sh
# Trigger a workflow manually (any of the above)
gh workflow run collector-weekly.yml

# Phase-M prune: dry-run (safe) vs REAL prune (deletes archive-verified cold bars)
gh workflow run collector-prune.yml                    # dry-run (default)
gh workflow run collector-prune.yml -f dry_run=false   # LIVE prune (USER gate)

# List recent runs of a workflow
gh run list --workflow=collector-daily.yml --limit 10

# Watch a run live / view logs
gh run watch <run-id>
gh run view <run-id> --log

# What scheduled workflows exist + their state
gh workflow list
```

> **Cron caveat:** GitHub Actions schedules can be **delayed or skipped** under
> platform load (esp. on the hour). Every collector job also exposes
> `workflow_dispatch` as a manual fallback, and the collector jobs are
> idempotent (incremental cursor / `ON CONFLICT` / supersede), so a missed run
> self-heals on the next run or a manual trigger.

### Config used by the jobs

- **Secrets** (`Settings → Secrets and variables → Actions → Secrets`):
  `DATABASE_URL` (Supabase **session** pooler `...pooler.supabase.com:5432`),
  `POSTGRES_URL_NON_POOLING`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SEC_USER_AGENT`.
- **Variables** (`… → Variables`): `COLLECTOR_ARCHIVE_PARQUET` (`1` = on),
  `COLLECTOR_PARQUET_BUCKET` (`market-archive`).
  - Inspect: `gh variable list` · `gh secret list` (names only).

---

## 2. Supabase `pg_cron` (in-database, pure SQL)

`pg_cron` runs SQL on a schedule **inside Postgres** — no Python, no network, no
Storage access. Used only for SQL housekeeping.

| jobid | Cron (UTC) | Active | Command | Purpose |
|---|---|---|---|---|
| 1 | `0 3 * * *` | yes | `delete from error_log where created_at < now() - interval '7 days'` | Daily 03:00 — `error_log` 7-day retention (telemetry table, no tombstone needed). |

### Inspect / manage (SQL — Supabase SQL Editor or `psql`)

```sql
-- List all scheduled jobs
select jobid, schedule, command, active from cron.job order by jobid;

-- Recent execution history (success/failure, timing)
select jobid, status, return_message, start_time, end_time
from cron.job_run_details
order by start_time desc
limit 20;

-- Schedule a new job  → returns jobid
select cron.schedule('job-name', '0 3 * * *', $$ delete from … $$);

-- Change / remove
select cron.unschedule('job-name');   -- or: select cron.unschedule(<jobid>);
```

> **Why prune is NOT pg_cron:** the Phase-M retention prune must verify each
> `(ticker,year)` Parquet object exists in Storage **before** deleting, map
> `label→symbol`, and no-op when the archive is unreachable — none of which SQL
> can do. It is a Python entrypoint on GitHub Actions (`collector-prune.yml`).

---

## Quick "what runs when" (UTC week view)

- **Daily 03:00** — pg_cron: error_log purge
- **Mon–Fri 21:30** — collector-daily (OHLC)
- **Sun 06:00** — collector-weekly (rankings)
- **Mon & Thu 09:00** — supabase-keepalive
- **1st & 15th 12:00** — collector-keepalive
- **1st 07:00** — collector-monthly (13F)
- **Dec 30 07:00** — collector-prune (dry-run)

Manual-only: `collector-seed-archive` (Parquet full seed), `ci` (push/PR).
