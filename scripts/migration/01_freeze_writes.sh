#!/usr/bin/env bash
# 01 — Freeze writers so the dump has no delta. Finance is private/low-traffic,
# so a short freeze is acceptable (no live-delta re-sync). MANUAL confirmations below.
source "$(dirname "$0")/00_env.sh"

cat <<'EOF'
FREEZE CHECKLIST (do these, then press enter):

  finance writers:
    [ ] Disable GitHub Actions collector crons
        gh workflow disable collector-daily.yml collector-monthly.yml collector-weekly.yml \
          collector-options-daily.yml collector-security-map.yml collector-politician-trades.yml \
          collector-committees-enrich.yml collector-bioguide-enrich.yml collector-seed-archive.yml
    [ ] Stop any running finance_api / dashboard_server finance write path

  blog writers:
    [ ] Pause blog_agent publish (publish_oneshot.py) — do not publish during dump

  If a write slips through after this point, re-dump only the affected single table.
EOF
read -r -p "All writers frozen? [y/N] " ok
[ "$ok" = "y" ] || { echo "aborted"; exit 1; }
echo "frozen — proceed to 10_dump_blog.sh / 11_dump_finance.sh"
