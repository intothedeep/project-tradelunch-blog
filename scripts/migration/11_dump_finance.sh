#!/usr/bin/env bash
# 11 — Dump the 17 finance tables from SRC (schema+data, custom format).
# The MV mv_sec_new_positions is NOT dumped as data — it is regenerated (32_refresh_mv.sql).
source "$(dirname "$0")/00_env.sh"

OUT="$DUMP_DIR/finance.dump"
echo "dumping finance tables → $OUT"
# shellcheck disable=SC2046
pg_dump -Fc --no-owner --no-privileges \
  $(_t_flags "$FINANCE_TABLES") \
  "$SRC_NON_POOLING" -f "$OUT"

echo "done: $(du -h "$OUT" | cut -f1)"
pg_restore -l "$OUT" | grep -cE "TABLE DATA" | xargs echo "table-data entries:"
