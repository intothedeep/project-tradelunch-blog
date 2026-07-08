#!/usr/bin/env bash
# 60 — Post-cutover smoke tests. Run from a Vercel-region box AND a GitHub runner
# to confirm IPv4 reachability of the Oracle box (the exact issue that forced the
# Supabase pooler originally).
source "$(dirname "$0")/00_env.sh"

echo "── connectivity"
psql "$DST_SB_NON_POOLING" -c 'select 1' >/dev/null && echo "DST-SB ok"
psql "$ORA_DIRECT"         -c 'select 1' >/dev/null && echo "ORA direct ok"
psql "$ORA_POOLED"         -c 'select 1' >/dev/null && echo "ORA pgbouncer ok"

echo "── app probes (run manually):"
cat <<'EOF'
  dashboard_server: POSTGRES_URL=$DST_SB_POOLED pnpm --filter dashboard_server dev  &&  test
  blog_agent:       uv run python -c 'read one post'
  stock_collector:  DATABASE_URL=$ORA_DIRECT uv run <read_tracked_symbols dry-run>
  storage:          upload one blog image via uploadImage.ts → fetch via assets.prettylog.com
                    presign one market-archive object
EOF
echo "── then run 40_reconcile_counts.sh (must be all-green)"
