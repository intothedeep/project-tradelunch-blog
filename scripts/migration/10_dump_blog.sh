#!/usr/bin/env bash
# 10 — Dump the 11 blog tables from SRC (schema+data, custom format).
source "$(dirname "$0")/00_env.sh"

OUT="$DUMP_DIR/blog.dump"
echo "dumping blog tables → $OUT"
# shellcheck disable=SC2046
pg_dump -Fc --no-owner --no-privileges \
  $(_t_flags "$BLOG_TABLES") \
  "$SRC_NON_POOLING" -f "$OUT"

echo "done: $(du -h "$OUT" | cut -f1)"
pg_restore -l "$OUT" | grep -cE "TABLE DATA" | xargs echo "table-data entries:"
