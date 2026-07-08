-- 32 — Rebuild materialized views on Oracle AFTER finance data is restored.
-- Run:  psql "$ORA_DIRECT" -v ON_ERROR_STOP=1 -f 32_refresh_mv.sql
-- MVs are regenerated from base tables (sec_holdings ⋈ security_map), not dumped as data.
-- Do this single-threaded, post-restore, with swap present (RAM can spike on 1GB).

REFRESH MATERIALIZED VIEW mv_sec_new_positions;
-- 0031 added a CUSIP-mapped MV variant; refresh it too if present as a separate object.
-- \dm  to list materialized views, then REFRESH each remaining one.
