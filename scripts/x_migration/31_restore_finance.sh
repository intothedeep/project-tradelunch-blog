#!/usr/bin/env bash
# 31 — Load the finance dump into Oracle PG17. SINGLE-THREADED (--jobs 1) —
# parallel restore builds N indexes at once × maintenance_work_mem → OOM on 1GB.
# Staged pre-data → data → post-data so indexes build once, after bulk COPY.
source "$(dirname "$0")/00_env.sh"

D="$DUMP_DIR/finance.dump"
R() { pg_restore --no-owner --no-privileges "$@" -d "$ORA_DIRECT" "$D"; }

echo "── pre-data (tables, types)";      R --section=pre-data
echo "── data (COPY, triggers off)";     R --section=data --disable-triggers
echo "── post-data (indexes, FKs, MV)";  R --section=post-data --jobs 1

cat <<'EOF'
finance data restored (single-threaded).
Next:
  - Run 32_refresh_mv.sql to build mv_sec_new_positions (+ mapped variant).
  - If restore reported a missing extension/function, add it in 21_ora_provision.sql and re-run post-data.
  - TEMP speed knobs (fsync=off, full_page_writes=off) — if you set them, REVERT + restart before go-live.
EOF
