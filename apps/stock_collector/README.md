# stock_collector

Market-data collector feeding the tradelunch dashboard. Python, managed by
**uv**. Polyglot sibling app — NOT a pnpm workspace member. See repo
`00.plan.md` / `00.tasks.md` (Phases I → N).

The dashboard NEVER calls Yahoo/SEC at request time — it reads only what this
collector has already written to **Supabase Postgres**. This app is the sole
writer of the market-data tables; batch jobs run on **GitHub Actions cron** and
are idempotent (incremental cursor / `ON CONFLICT` / supersede), so a missed or
re-run job self-heals.

## What it does (and why)

| Job | What it writes | Why |
| --- | --- | --- |
| **Daily** (`run_daily`) | Daily OHLC bars (Yahoo/yfinance) for the watchlist → `market_history` (interval `1d`, incremental) + `market_snapshots` (latest close + 1-day change). | The dashboard's price/series data. Incremental cursor keeps each run cheap; optional Parquet archive to Storage. |
| **Weekly** (`run_weekly`) | S&P500-class market-cap ranking, global + per-sector → `market_rankings`; sticky `tracked_symbols` (global top-20 / sector top-10); `symbol_fundamentals` cache (shares / sector / company **name**). | Powers the ranking views and keeps the watchlist self-expanding. Market cap is derived from cached `shares × close` to avoid a per-symbol `.info` call. The company name (`long_name`, migration 0018) rides the SAME quarterly `.info` call as sector and renders under the ticker in `/rankings`. |
| **Weekly 13F** (`run_monthly`) | SEC EDGAR 13F institutional holdings → `sec_filings` + `sec_holdings`; supersedes earlier amendments for the same period. | Fund holdings / rank-flow views. **L19:** cron is weekly (Mon), but a period-advance guard makes it a cheap no-op except during the 4 quarterly 13F windows. |
| **13F backfill** (`run_backfill`) | Historical 13F from `--since` (default ~2yr back) across all funds, per period. | One-shot seed of fund history. `--db-keep-quarters` decouples the long Parquet cold-archive from the short free-tier Postgres serving window. |
| **Security map** (`run_security_map`) | CUSIP → ticker → sector for the ever-top-N 13F holdings (OpenFIGI `/v3/mapping` + `symbol_fundamentals`) → `security_map`. | Phase P join key: 13F is CUSIP-only, prices/rankings are ticker-only. Reads go through the `v_sec_holdings_enriched` view (no `sec_holdings.ticker` backfill). Weekly, 1h after the 13F job. OpenFIGI is keyless-tolerant (`OPENFIGI_API_KEY` raises the limit). |
| **Rankings archive** (`archive_rankings`) | `market_rankings` → `rankings/{YYYY}.parquet` on Storage. | Rankings are point-in-time and NON-reproducible (no shares-outstanding history). Wired into the weekly job so the current-year cold copy stays fresh — the precondition for the rankings prune. |
| **OHLC/13F Parquet archive** (`seed_archive`, `upload_archive`) | Full inception history → Parquet on Supabase Storage. | Cold storage that the retention prunes verify against before any delete. |
| **Retention prunes** | `prune_history` (OHLC 5yr), `prune_holdings` (13F 3yr), `prune_rankings` (10yr), `prune_logs` (`error_log` 7d / `batch_log` 90d). | Keep the free-tier Postgres lean. Domain prunes hard-delete ONLY after confirming the row's Parquet object exists in Storage (all-or-skip). |

> **Company-name note:** `long_name` comes from Yahoo `.info` `longName`
> (`shortName` fallback) — the SAME expensive call already made for `sector`, so
> no extra network per symbol. `plan_refresh` forces an `.info` refetch whenever
> `long_name IS NULL`, so ONE weekly run backfills the whole universe; at
> `YAHOO_RPM=30` a ~1,000-symbol first backfill takes ~35 min (a one-time cost —
> later runs only refetch stale/new symbols). Reads/writes probe the column, so
> the run is safe before migration 0018 is applied (name stays NULL).
> _Future optimization:_ the S&P500 constituents CSV already fetched each run
> carries a `Security` (company-name) column — currently discarded; wiring it in
> would name the ~500 large caps with ZERO extra calls (Yahoo `.info` would then
> only cover the non-S&P remainder).

> **Soft-delete note:** the repo rule is tombstone-not-delete. The domain prunes
> (`prune_history`/`prune_holdings`/`prune_rankings`) and log prunes
> (`prune_logs`) are OWNER-SIGNED-OFF hard-delete exceptions, scoped STRICTLY to
> derived + archived operational rows — never user-generated content. Every
> domain prune requires an archive-object-exists check first.

## Setup

```sh
uv sync --extra dev          # create .venv + install (incl. pytest)
cp .env.example .env         # then fill real values
```

Env (`.env`, loaded via python-dotenv — do NOT quote or leave empty):

- `DATABASE_URL` — **required**. Supabase **session** pooler (IPv4, port 5432,
  `aws-0-<region>.pooler.supabase.com:5432`) — NOT the IPv6-only `db.<ref>`
  host. Falls back to `POSTGRES_URL_NON_POOLING`.
- **OHLC/rankings Parquet archive** (optional): `SUPABASE_URL`,
  `SUPABASE_SECRET_KEY`, `SHOULD_COLLECTOR_ARCHIVE_MARKET_PARQUET=1`,
  `COLLECTOR_MARKET_PARQUET_BUCKET` (default `market-archive`).
- **13F**: `SEC_USER_AGENT` (descriptive UA, else SEC returns 403). 13F Parquet
  cold archive is gated by `SHOULD_COLLECTOR_ARCHIVE_SEC_PARQUET=1` (or `--archive`),
  bucket `COLLECTOR_SEC_PARQUET_BUCKET` (default `sec-archive`, PRIVATE). The separate
  raw info-table XML archive uses `COLLECTOR_ARCHIVE_SEC` / `COLLECTOR_SEC_BUCKET`.
- **Provider tuning** (optional): `YAHOO_RPM` (default 30).

## Run — terminal (`uv`)

```sh
uv run pytest                                          # transform/ranking specs (stdlib-only, no network)

# collection
uv run python -m collector.entrypoints.run_daily      # daily OHLC + snapshots
uv run python -m collector.entrypoints.run_weekly     # market-cap ranking + sticky universe
uv run python -m collector.entrypoints.run_monthly    # weekly SEC 13F (period-advance guarded)
uv run python -m collector.entrypoints.run_backfill --since 2013 --db-keep-quarters 12 --archive   # 13F: Parquet full 2013→, DB last 3yr
uv run python -m collector.entrypoints.run_security_map --dry-run   # CUSIP→ticker: preview candidate count (no OpenFIGI/writes)

# archive (cold storage on Supabase Storage)
uv run python -m collector.entrypoints.seed_archive       # FULL inception history → Parquet
uv run python -m collector.entrypoints.upload_archive     # push local Parquet → Storage
uv run python -m collector.entrypoints.archive_rankings   # market_rankings → rankings/{YYYY}.parquet

# retention prunes (all default to --dry-run when run manually)
uv run python -m collector.entrypoints.prune_history  --dry-run   # OHLC 5yr
uv run python -m collector.entrypoints.prune_holdings --dry-run   # 13F 3yr
uv run python -m collector.entrypoints.prune_rankings --dry-run   # rankings 10yr (0 candidates until ~2036)
uv run python -m collector.entrypoints.prune_logs     --dry-run   # error_log 7d + batch_log 90d
```

### Common flags

| Flag | Applies to | Effect |
| --- | --- | --- |
| `--limit <int>` | most jobs | cap symbols/funds (`0` = all) |
| `--dry-run` | all writers/prunes | fetch/count only, no DB writes |
| `--archive` | `run_daily`, `run_backfill`, `run_monthly` | also write the Parquet archive |
| `--backfill-days <int>` | `run_daily` | look back N days |
| `--full` | `run_daily` | full history from inception (yfinance `period='max'`; ignores cursor) |
| `--since <YYYY[-MM-DD]>` | `run_backfill` | earliest period (default ~2yr back) |
| `--cik <int>` | `run_backfill`, `run_monthly`, `prune_holdings` | restrict to one fund |
| `--db-keep-quarters <int>` | `run_backfill` | DB write window (default 12 = 3yr); older periods archive-only |

Domain prunes delete a period/year ONLY if its Parquet object is confirmed
present in Storage (no-op if the archive is off/unreachable). `prune_logs` has
no archive precondition (owner-approved no-tombstone log tables) and keeps
`resolved=0` open `batch_log` failures at any age.

## Run — GitHub Actions (`gh` CLI)

All batch jobs run on GitHub Actions cron and each exposes `workflow_dispatch`
as a manual fallback.

```sh
gh workflow list                                       # what exists + enabled state
gh workflow run collector-weekly.yml                   # trigger manually

# retention prunes: manual dispatch defaults to dry-run; opt into a LIVE delete
gh workflow run collector-prune.yml                    # OHLC/13F/rankings — dry-run
gh workflow run collector-prune.yml -f dry_run=false   # LIVE prune (USER gate)

# one-shot 13F historical backfill (inputs: cik, since, db_keep_quarters, archive, dry_run)
# NOTE: unlike the prunes, this workflow defaults to LIVE (dry_run=false) — it writes.
gh workflow run collector-backfill.yml -f since=2013 -f db_keep_quarters=12 -f archive=true  # full 2013→ archive, DB last 3yr
gh workflow run collector-backfill.yml -f cik=0001067983                                     # one fund only
gh workflow run collector-backfill.yml -f dry_run=true                                       # preview (no writes)

gh workflow run collector-security-map.yml                    # CUSIP→ticker resolve (LIVE)
gh workflow run collector-security-map.yml -f dry_run=true    # preview candidate count

# inspect
gh run list --workflow=collector-daily.yml --limit 10
gh run watch <run-id>
gh run view <run-id> --log
gh variable list ; gh secret list                      # config the jobs read (names only)
```

Secrets the jobs read: `DATABASE_URL` (session pooler),
`POSTGRES_URL_NON_POOLING`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
`SEC_USER_AGENT`. Variables: `SHOULD_COLLECTOR_ARCHIVE_MARKET_PARQUET` (`1`=on),
`COLLECTOR_MARKET_PARQUET_BUCKET` (OHLC/rankings); `SHOULD_COLLECTOR_ARCHIVE_SEC_PARQUET`,
`COLLECTOR_SEC_PARQUET_BUCKET` (13F cold archive).

## Production schedule (cron, UTC)

| Workflow | Cron | Cadence | Runs |
| --- | --- | --- | --- |
| `collector-daily` | `30 21 * * 1-5` | Mon–Fri (after US close) | `run_daily` → `upload_archive` |
| `collector-weekly` | `0 6 * * 0` | Sun | `run_weekly` → `archive_rankings` |
| `collector-monthly` (`collector-13f`) | `0 7 * * 1` | Mon (weekly, L19) | `run_monthly` |
| `collector-security-map` | `0 8 * * 1` | Mon (1h after 13F) | `run_security_map` (CUSIP→ticker) |
| `collector-prune-logs` | `0 3 * * *` | Daily | `prune_logs` — **LIVE** (no archive gate) |
| `collector-prune` | `0 7 30 12 *` | Dec 30 | OHLC 5yr **LIVE** + 13F + rankings prune (scheduled = dry-run) |
| `collector-keepalive` | `0 12 1,15 * *` | 1st & 15th | idle keepalive ping |
| `supabase-keepalive` | `0 9 * * 1,4` | Mon & Thu | DB write ping (free-tier auto-pause guard) |
| `collector-backfill` | — | manual (**LIVE by default**) | `run_backfill` (13F history; `-f dry_run=true` to preview) |
| `collector-seed-archive` | — | manual | `seed_archive` (full inception) → `upload_archive` |
| `ci` | — | push / PR | build + typecheck + lint + tests |

**No active Supabase `pg_cron` jobs** — `cron.job` is empty. The former
`error_log_cleanup` pg_cron purge was retired 2026-06-30 (Phase N); `error_log`
retention now lives on the self-observing `collector-prune-logs` workflow.

Full schedule + inspection reference: [`.github/CRON.md`](../../.github/CRON.md).
