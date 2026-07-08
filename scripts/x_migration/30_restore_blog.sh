#!/usr/bin/env bash
# 30 — Load blog DATA into DST-SB (schema already replayed by 20_dst_sb_schema.sh).
# --data-only because the schema+RLS came from the migration replay, not the dump.
source "$(dirname "$0")/00_env.sh"

pg_restore --data-only --disable-triggers --no-owner --no-privileges \
  -d "$DST_SB_NON_POOLING" "$DUMP_DIR/blog.dump"

echo "blog data restored. Verify snowflake-ID sequences did not collide:"
echo "  psql \"\$DST_SB_NON_POOLING\" -c \"SELECT max(id) FROM posts;\""
