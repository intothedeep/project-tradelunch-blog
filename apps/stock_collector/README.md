# stock_collector

Market-data collector feeding the tradelunch dashboard. Python, managed by
**uv**. Polyglot sibling app — NOT a pnpm workspace member. See repo
`00.plan.md` / `00.tasks.md` Phase I.

## What it can do

- **Daily** — fetch daily OHLC bars (Yahoo / yfinance) for the watchlist
  (`configs/watchlist.yaml`, ≤42 labels + sticky-ranked symbols) and write
  `market_history` (interval `1d`, incremental) + `market_snapshots` (latest
  close + 1-day change). Optionally archive bars to Parquet on Supabase Storage.
- **Weekly** — compute an S&P500-class market-cap ranking (global + per-sector)
  → `market_rankings`, sticky `tracked_symbols` (top-20 global / top-10 sector),
  and a `symbol_fundamentals` cache.
- **Monthly** — collect SEC 13F institutional holdings (requires a descriptive
  `SEC_USER_AGENT`, else SEC returns 403).
- **Backfill** — seed full history from inception (`--full`) or N days back.

Writes go to **Supabase Postgres**; no Yahoo call happens at dashboard request
time (the dashboard reads pre-collected data).

## Setup

```sh
uv sync --extra dev
```

Env (copy `.env.example` → `.env`):

- `DATABASE_URL` — **required**, Supabase session pooler (IPv4, port 5432).
  Falls back to `POSTGRES_URL_NON_POOLING`.
- Optional Parquet archive: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE` /
  `SUPABASE_SECRET_KEY`, `COLLECTOR_ARCHIVE_PARQUET`, `COLLECTOR_PARQUET_BUCKET`.
- Monthly 13F: `SEC_USER_AGENT` (required), `COLLECTOR_ARCHIVE_SEC`,
  `COLLECTOR_SEC_BUCKET`.

## Run

```sh
uv run pytest                                          # transform/ranking specs (stdlib-only, no network)

uv run python -m collector.entrypoints.run_daily       # daily OHLC + snapshots
uv run python -m collector.entrypoints.run_weekly      # market-cap ranking
uv run python -m collector.entrypoints.run_monthly     # SEC 13F holdings
uv run python -m collector.entrypoints.seed_archive    # FULL history from inception → Parquet
uv run python -m collector.entrypoints.upload_archive  # push Parquet archive to Storage
uv run python -m collector.entrypoints.prune_history --dry-run  # 5yr OHLC retention (drop --dry-run to delete)
```

### `run_daily` flags

| Flag                    | Effect                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `--limit <int>`         | cap number of symbols (`0` = all)                                                     |
| `--backfill-days <int>` | look back N days                                                                      |
| `--dry-run`             | fetch only, no DB writes                                                              |
| `--archive`             | also write the Parquet archive                                                        |
| `--full`                | full history from inception (ignores cursor + backfill-days; yfinance `period='max'`) |

`run_weekly` / `run_monthly` / `prune_history` accept `--limit` and/or `--dry-run`;
`seed_archive` always seeds FULL inception history (`--limit` caps symbols).
`prune_history` deletes `market_history` bars older than 5 calendar years, but
ONLY ones already in the Parquet archive (no-op if the archive is off/unreachable).

## Production schedule (GitHub Actions cron, UTC)

| Workflow                 | Cron                             | Command                                                                                                                                   |
| ------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `collector-daily`        | `30 21 * * 1-5` (after US close) | `run_daily` → `upload_archive`                                                                                                            |
| `collector-weekly`       | `0 6 * * 0`                      | `run_weekly`                                                                                                                              |
| `collector-monthly`      | `0 7 1 * *`                      | `run_monthly`                                                                                                                             |
| `collector-prune`        | `0 7 30 12 *` (Dec 30)           | `prune_history` — 5yr OHLC retention; **scheduled run is LIVE** (deletes archive-verified cold bars), manual dispatch defaults to dry-run |
| `collector-seed-archive` | manual `workflow_dispatch`       | `seed_archive` (full inception) → `upload_archive`                                                                                        |

Plus `collector-keepalive` / `supabase-keepalive` (idle keepalive pings) and a
Supabase `pg_cron` job (daily `error_log` 7-day purge). Full schedule reference:
[`.github/CRON.md`](../../.github/CRON.md).
