# Migration RUNBOOK — follow this in order

Sequential execution checklist for the 2026-07-08 refined migration. This is the
**do-this-then-that** guide; `README.md` is the what/why + script index;
`db-migration-oracle.md` (repo root) is the deep reference.

**Golden rules**
- Old Supabase (SRC) stays LIVE until Phase 5 — it is the rollback anchor. Never delete early.
- Finance and blog are **independent** cutovers. Do **finance first** (private, low-risk), then blog.
- Every gate below is a hard stop. Do not proceed on a red check.
- Escape hatch at any point: `90_rollback.sh` (revert env/secrets + Cloudflare → SRC).

Legend: 🖥️ = run a script · ✋ = manual action (console/dashboard) · ✅ = verify · ↩️ = rollback note

---

## Phase 0 — Provision & prep  (NO cutover — fully reversible)

- [ ] ✋ **Oracle VM**: create Always-Free AMD micro (1 OCPU / 1GB), install PostgreSQL 17.
- [ ] ✋ Open VCN Security List / firewall: inbound `5432` (+ `6432` if PgBouncer). Confirm the box has a **public IPv4** address (Vercel + GitHub runners must reach it — the exact reason Supabase forced the pooler).
- [ ] 🖥️ `22_ora_tune.sh` — 2GB swap + `postgresql.conf` for 1GB + OOM guard. Then `sudo systemctl restart postgresql`.
- [ ] 🖥️ `psql ... -f 21_ora_provision.sql` — create `finance` DB, `app` role, extensions. Set the app password.
- [ ] ✋ Enable server TLS (`ssl = on` + self-signed cert). **Required** — node-pg/asyncpg force SSL and will refuse to connect without it.
- [ ] 🖥️ `23_pgbouncer_setup.sh` — PgBouncer transaction mode on `:6432` (optional at low traffic; recommended for Vercel Fluid).
- [ ] ✋ **New Supabase project** (DST-SB) for the blog DB. Match the PG major of SRC. Record pooled (`:6543`) + non-pooling (`:5432`) DSNs.
- [ ] ✋ `cp 00_env.sh.example 00_env.sh` and fill SRC / DST-SB / ORA / OCI creds. (Never commit it — gitignored.)
- [ ] ✅ Reachability: from a Vercel-region box AND a GitHub runner, `psql "$ORA_DIRECT" -c 'select 1'` and `psql "$DST_SB_NON_POOLING" -c 'select 1'`.
- [ ] ✅ Dry-run the dump scripts against SRC into a throwaway; confirm table-data counts look sane.

**Exit gate:** ORA reachable + TLS on + DST-SB created + `00_env.sh` filled. ↩️ Nothing live changed yet.

---

## Phase 1 — Finance DB → Oracle  (cutover #1)

**Pre-gates (both must be GREEN — see README "Two gates"):**
- [ ] ✅ `finance_api` carve shipped, OR `dashboard_server` has a second pool to ORA for finance reads (no single-pool finance-on-blog-server during the cut).
- [ ] ✅ Crawler / unbounded-query fix in place (`funds.ts:195`, `dashboard.ts:140` have no LIMIT — a 1GB box is DoS-trivial without it).

**Steps:**
- [ ] 🖥️ `01_freeze_writes.sh` — disable collector crons + stop finance writers (confirm the checklist).
- [ ] 🖥️ `11_dump_finance.sh` → `_dumps/finance.dump`.
- [ ] 🖥️ `31_restore_finance.sh` — single-threaded (`--jobs 1`), staged pre/data/post. Watch RAM; swap is the backstop.
- [ ] 🖥️ `psql "$ORA_DIRECT" -f 32_refresh_mv.sql` — rebuild `mv_sec_new_positions` (+ mapped variant).
- [ ] ✅ `40_reconcile_counts.sh` — finance section must be **all-green** (row counts SRC == ORA). Red → STOP.
- [ ] ✋ Repoint secrets → Oracle **session** DSN (`:5432 ?sslmode=require`):
  - `stock_collector` local `.env`: `DATABASE_URL`
  - GitHub Actions secrets: `DATABASE_URL`, `POSTGRES_URL_NON_POOLING` (collector workflows — YAML unchanged, values only)
  - `finance_api` (or `dashboard_server` finance pool): `POSTGRES_URL` → ORA `:6432`/`:5432`
- [ ] 🖥️ `60_smoke.sh` + collector dry-run (`DATABASE_URL=$ORA_DIRECT uv run ... read_tracked_symbols`).
- [ ] ✋ Re-enable collector crons (or manually `gh workflow run collector-daily.yml`) → confirm one green run against ORA.

**Exit gate:** finance reconcile green + collector runs green on ORA. ↩️ `90_rollback.sh` reverts collector/finance secrets to SRC.

---

## Phase 2 — Blog DB → new Supabase  (cutover #2)

- [ ] 🖥️ `01_freeze_writes.sh` — pause `blog_agent` publish (do not publish during the blog dump).
- [ ] 🖥️ `10_dump_blog.sh` → `_dumps/blog.dump`.
- [ ] 🖥️ `20_dst_sb_schema.sh` — replay blog-only migrations into DST-SB (RLS on the 7 original tables only; do NOT add more).
- [ ] 🖥️ `30_restore_blog.sh` — `--data-only`. Then verify snowflake-ID sequences did not collide (`SELECT max(id) FROM posts;`).
- [ ] ✅ `40_reconcile_counts.sh` — blog section all-green. Red → STOP.
- [ ] ✋ Repoint blog secrets → DST-SB:
  - `dashboard_server`: `POSTGRES_URL` (`:6543`), `POSTGRES_URL_NON_POOLING` (`:5432`)
  - `blog_agent`: `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL`
  - GitHub secret `BLOG_SUPABASE_DATABASE_URL` = DST-SB pooled URI (for `supabase-keepalive.yml`)
- [ ] ✋ Redeploy both Vercel projects (dashboard_server + dashboard_client_web).
- [ ] 🖥️ `60_smoke.sh` + `dashboard_server` jest (86/86 baseline) + read a blog post via the app.
- [ ] ✋ Resume `blog_agent` publish.

**Exit gate:** blog reconcile green + app serves blog from DST-SB + keepalive pings DST-SB. ↩️ revert blog secrets + redeploy → SRC.

---

## Phase 3 — Stabilize  (both DBs live, ≥1 week)

- [ ] ✅ Watch Oracle: RAM/swap usage, no OOM-kills (`journalctl -u postgresql`), no connection exhaustion.
- [ ] ✅ Watch collector cron runs (daily/weekly) stay green on ORA.
- [ ] ✅ Re-run `40_reconcile_counts.sh` periodically — stays green as new writes land.
- [ ] ✋ Set up off-box backups + WAL archiving for ORA, and a **tested restore** (self-host = your responsibility now).
- [ ] Keep SRC untouched. Do NOT start Phase 5 until this phase is clean for a week.

---

## Phase 4 — Storage → Oracle Object Storage  (SEPARATE phase, after DB is stable)

> Deferred by decision (2026-07-08). Couples with the collector boto3 rewrite (10 files:
> `storage_sink.py` + `config/settings.py` arity 2→3 + 7 entrypoints + boto3 dep) and the
> `dashboard_server`/`blog_agent` storage code. Do NOT rename storage env in workflows until the code reads it.

- [ ] ✋ Create OCI buckets: `blog.prettylog` (public read), `market-archive` + `sec-archive` (private). Issue OCI Customer Secret Key.
- [ ] 🖥️ `50_storage_presync.sh` — rclone pre-copy all 3 buckets (live, no downtime).
- [ ] ✋ Swap the 3 storage code paths to S3 SDK: `dashboard_server/src/helpers/uploadImage.ts` (add HEAD-guard for `x-upsert:false`), `blog_agent/db/storage.py`, `stock_collector/.../storage_sink.py` (+ config + 7 entrypoints).
- [ ] ✋ Rename storage env `SUPABASE_*` → `OCI_S3_*` in the collector workflows + all app `.env` / Vercel.
- [ ] 🖥️ `51_storage_resync.sh` — final delta re-sync.
- [ ] ✋ Repoint Cloudflare `assets.prettylog.com` origin → OCI (keep `CDN_ASSETS` value). Purge cache.
- [ ] ✋ Deploy + verify: upload a blog image → resolves via `assets.prettylog.com`; presign one archive object.
- [ ] Keep Supabase Storage live ≥1 week, then release.

---

## Phase 5 — Decommission & scrub  (only after Phases 3+4 clean)

- [ ] Follow `91_rotate_secrets.md`: rotate/scrub root `.env` SRC secrets; revoke SRC S3 keys; remove SRC Supabase Vercel integration.
- [ ] ✅ Confirm `supabase-keepalive.yml` now pings DST-SB only (drop the `DATABASE_URL` fallback once `BLOG_SUPABASE_DATABASE_URL` is confirmed).
- [ ] ✋ **Last:** decommission the old SRC Supabase project (DB + storage). This is irreversible — do it only when everything above is green and a week has passed.

---

## Quick script index

| # | script | phase |
|---|---|---|
| 00 | `00_env.sh` (from `.example`) | 0 |
| 21/22/23 | ora provision / tune / pgbouncer | 0 |
| 01 | freeze writes | 1, 2 |
| 11 / 31 / 32 | dump / restore / refresh MV (finance) | 1 |
| 10 / 20 / 30 | dump / schema / restore (blog) | 2 |
| 40 | reconcile counts (GO/NO-GO) | 1, 2, 3 |
| 50 / 51 | storage pre-sync / re-sync | 4 |
| 60 | smoke tests | 1, 2 |
| 90 | rollback | any |
| 91 | rotate secrets | 5 |
