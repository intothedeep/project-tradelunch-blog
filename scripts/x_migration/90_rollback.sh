#!/usr/bin/env bash
# 90 — Rollback = revert env vars + Cloudflare origin to SRC. SRC (DB + storage) is
# kept live ≥1 week, so rollback is instant and lossless. No data is destroyed here.
set -euo pipefail

cat <<'EOF'
ROLLBACK (revert to current Supabase SRC):

  1. Vercel — both projects (dashboard_server, dashboard_client_web):
       restore POSTGRES_URL / POSTGRES_URL_NON_POOLING / SUPABASE_* to SRC values, redeploy.
  2. GitHub Actions secrets: restore DATABASE_URL / POSTGRES_URL_NON_POOLING to SRC.
  3. blog_agent / stock_collector local .env: restore SRC DSNs.
  4. Cloudflare: point assets.prettylog.com origin back to Supabase storage. Purge cache.
  5. Re-enable the collector crons + supabase-keepalive.yml if it was soft-deleted.

Keep SRC untouched until reconciliation stays green for ≥1 week, THEN decommission.
Do NOT delete SRC before that — it is the rollback anchor.
EOF
