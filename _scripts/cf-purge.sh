#!/usr/bin/env bash
# Purge the Cloudflare edge cache for prettylog.
#
# Why this exists: Phase CF2 caches HTML at the edge for 24h, and nothing in
# this repo purges on publish. So after publishing a post, the new content is
# invisible to anonymous visitors until the TTL expires — unless you run this.
#
#   ./_scripts/cf-purge.sh                       # purge everything (the usual case)
#   ./_scripts/cf-purge.sh https://my.prettylog.com/ https://my.prettylog.com/blog
#   ./_scripts/cf-purge.sh --dry-run             # show what would be sent
#
# Credentials, from the environment or a .env file beside this script:
#   CLOUDFLARE_API_TOKEN  — needs the "Zone → Cache Purge → Purge" permission
#                           on this zone. Do NOT use a Global API Key.
#   CLOUDFLARE_ZONE_ID    — Cloudflare dashboard → the zone → Overview,
#                           bottom right under "Zone ID".

set -euo pipefail

ZONE_NAME="prettylog.com"
API="https://api.cloudflare.com/client/v4"

DRY_RUN=0
URLS=()
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        # Print the header comment, stopping at the first non-comment line.
        -h|--help) sed -n '2,${/^#/!q;p;}' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        -*) echo "unknown flag: $arg" >&2; exit 2 ;;
        *) URLS+=("$arg") ;;
    esac
done

# Load a local .env if present (never committed — see .gitignore).
ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.env"
if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a; source "$ENV_FILE"; set +a
fi

: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN (Zone → Cache Purge → Purge)}"
: "${CLOUDFLARE_ZONE_ID:?set CLOUDFLARE_ZONE_ID (dashboard → zone → Overview)}"

if [[ ${#URLS[@]} -eq 0 ]]; then
    BODY='{"purge_everything":true}'
    WHAT="everything in $ZONE_NAME"
else
    # Build {"files":["...","..."]} without assuming jq is installed.
    files=""
    for u in "${URLS[@]}"; do
        [[ "$u" == https://* ]] || { echo "URL must be absolute https: $u" >&2; exit 2; }
        files+="\"$u\","
    done
    BODY="{\"files\":[${files%,}]}"
    WHAT="${#URLS[@]} URL(s)"
fi

echo "purging $WHAT"

if [[ $DRY_RUN -eq 1 ]]; then
    echo "POST $API/zones/\$CLOUDFLARE_ZONE_ID/purge_cache"
    echo "$BODY"
    exit 0
fi

response=$(curl -sS -X POST \
    "$API/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "$BODY")

# Cloudflare answers 200 with {"success":false,...} on a rejected purge, so the
# body decides the exit code, not the HTTP status.
if printf '%s' "$response" | grep -q '"success":[[:space:]]*true'; then
    echo "purged."
    echo
    echo "Verify (expect MISS, then HIT on a second call):"
    echo "  curl -sI https://my.prettylog.com/ | grep -i cf-cache-status"
else
    echo "purge FAILED:" >&2
    printf '%s\n' "$response" >&2
    exit 1
fi
