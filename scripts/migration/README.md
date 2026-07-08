# Supabase → {New Supabase (blog) + Oracle (finance)} migration

▶ **To execute the migration, follow [`RUNBOOK.md`](./RUNBOOK.md)** (sequential checklist). This file is the what/why + script index.

Runnable scripts for the 2026-07-08 refined migration. Plan source: `db-migration-oracle.md`
(scope now inverted) + `00.finance.plan.md` (§5.1 table SSOT). Full architect plan lives in
the task history; this dir is the executable form.

## Scope

| Target | From | To |
|---|---|---|
| blog DB (11 tables) | current Supabase (SRC) | **NEW Supabase** (DST-SB) |
| blog storage `blog.prettylog` | SRC Storage | **Oracle Object Storage** |
| finance DB (17 tables + MV) | SRC | **Oracle PG17** (AMD micro 1 OCPU / 1GB + 2GB swap) |
| finance storage `market-archive` / `sec-archive` | SRC Storage | **Oracle Object Storage** |

The current Supabase project is fully emptied, then kept ≥1 week as rollback anchor.

## Your 3 questions

1. **Backfill to re-collect instead of dump?** No, not as the primary path. **Blog data
   (posts/comments/likes) cannot be re-collected** — it's user-generated → dump is mandatory.
   Finance data *could* be backfilled, but SEC/yfinance rate-limits make it slow and past
   snapshots aren't perfectly reproducible. Use backfill only as a *post-migration verification*
   or to fill any freeze-window gap — not to move the data.
2. **Dump & move — better?** **Yes.** `pg_dump -Fc` → `pg_restore` is exact, fast, and preserves
   sequences/FKs. It's the decided method. Scripts `10/11` (dump) + `30/31` (restore).
3. **Migration scripts** — this directory. Numbered, idempotent, each sources `00_env.sh`.

## Run order

```
cp 00_env.sh.example 00_env.sh   # fill in SRC / DST-SB / ORA / OCI creds — DO NOT COMMIT

# provision (once)
21_ora_provision.sql   22_ora_tune.sh   23_pgbouncer_setup.sh   # on the Oracle VM
# create DST-SB Supabase project in the dashboard

# storage pre-copy (no downtime)
50_storage_presync.sh

# freeze → dump → schema → restore → MV → verify
01_freeze_writes.sh
10_dump_blog.sh        11_dump_finance.sh
20_dst_sb_schema.sh                                  # blog schema on DST-SB
30_restore_blog.sh     31_restore_finance.sh         # data
psql "$ORA_DIRECT" -f 32_refresh_mv.sql
40_reconcile_counts.sh                               # GO/NO-GO gate (must be all-green)

# cutover
#  → repoint env/secrets (see table below), redeploy Vercel ×2, repoint collector
51_storage_resync.sh                                 # final storage delta + Cloudflare flip
60_smoke.sh
91_rotate_secrets.md                                 # rotate SRC keys, soft-delete keepalive
# 90_rollback.sh is the escape hatch at any point
```

Cutover finance first (private/lower-risk), then blog.

## Env repoint (before → after)

| App | Var | After |
|---|---|---|
| dashboard_server | `POSTGRES_URL` / `_NON_POOLING` | DST-SB |
| dashboard_server / blog_agent / collector | `SUPABASE_*` | `OCI_S3_*` (+ `STORAGE_BUCKET`) |
| finance_api (Oracle VM) | `FINANCE_POSTGRES_URL` | ORA `:6432`/`:5432` |
| blog_agent | `POSTGRES_URL_NON_POOLING` / `POSTGRES_URL` | DST-SB |
| stock_collector + GH secrets | `DATABASE_URL` | ORA session `:5432 ?sslmode=require` |
| GH Actions `supabase-keepalive.yml` | `DATABASE_URL` | **repoint** to new blog Supabase via `BLOG_SUPABASE_DATABASE_URL` (blog still auto-pauses; NOT deleted) |
| dashboard_client_web | — | no DB change; `CDN_ASSETS` value unchanged |

## ⚠️ Two gates before finance goes on the 1GB box (owner must confirm)

1. **`finance_api` carve timing.** If it hasn't shipped, `dashboard_server` still serves
   finance reads → it needs BOTH DST-SB (blog) and ORA (finance) pools during the interim,
   OR delay the finance→ORA cut until the carve lands. Don't cut finance while blog server
   still owns finance reads with a single pool.
2. **Crawler / unbounded-query fix.** `funds.ts:195` and `dashboard.ts:140` have **no LIMIT**
   (the original billing-spike cause). A 1GB box is DoS-trivial under a crawler burst
   (`work_mem` × concurrency → OOM). Land the front-edge gate / LIMITs **before** exposing
   finance publicly. Hard prerequisite.

## Not automated (manual, by design)
- Creating the DST-SB Supabase project + OCI buckets + Cloudflare origin rewrite.
- The 3 storage-code S3-SDK swaps (`uploadImage.ts`, `storage.py`, `storage_sink.py`) — code,
  not migration ops. `x-upsert:false` in `uploadImage.ts` needs a HEAD-guard (S3 PUT overwrites).
- Filling secrets in `00_env.sh` and Vercel/GitHub.
