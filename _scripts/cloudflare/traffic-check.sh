#!/usr/bin/env bash
# Checks the Cloudflare cache rules (deploy/traffic/README.md steps 2 and 3).
# GET only: HEAD answers differ. Read-only, about 20 requests. Exit 1 on any FAIL.
set -u
W=${W:-https://my.prettylog.com}
A=https://blog-api.prettylog.com
fails=0

status() { curl -s -o /dev/null -D - "$@" | tr -d '\r' | awk -F': ' 'tolower($1)=="cf-cache-status"{print $2}'; }
header() { local name=$1; shift; curl -s -o /dev/null -D - "$@" | tr -d '\r' | awk -F': ' -v n="$name" 'tolower($1)==n{print $2}'; }

# check <label> <expected regex> <actual>
check() {
    if [[ $3 =~ ^($2)$ ]]; then printf 'PASS  %-34s %s\n' "$1" "$3"
    else printf 'FAIL  %-34s %s (want %s)\n' "$1" "${3:-none}" "$2"; fails=$((fails + 1)); fi
}

warm() { curl -s -o /dev/null "$@"; }

echo "== web ($W)"
for p in / /blog /robots.txt /sitemap.xml; do warm "$W$p"; check "GET $p (2nd)" 'HIT' "$(status "$W$p")"; done
check '__session cookie' 'BYPASS|DYNAMIC' "$(status -H 'Cookie: __session=x' "$W/")"
check '/me (protected)' 'BYPASS|DYNAMIC' "$(status "$W/me")"
check 'rsc header, no _rsc=' 'BYPASS|DYNAMIC' "$(status -H 'rsc: 1' "$W/")"
check '?_rsc= content-type' 'text/x-component.*' "$(header content-type -H 'rsc: 1' "$W/?_rsc=traffic-check")"
check 'HTML browser cache-control' 'private, no-cache, no-store.*' "$(header cache-control "$W/")"
check 'HTML set-cookie count' '0' "$(curl -s -o /dev/null -D - "$W/" | grep -ic '^set-cookie')"

echo "== api ($A)"
U="$A/v1/api/posts?limit=1"
warm "$U"; check 'GET posts?limit=1 (2nd)' 'HIT' "$(status "$U")"
check 'Authorization header' 'BYPASS|DYNAMIC' "$(status -H 'Authorization: Bearer x' "$U")"
warm "$A/ping"; check '/ping (no Cache-Control)' 'BYPASS|DYNAMIC|MISS' "$(status "$A/ping")"
check 'CORS my. origin echoed' "$W" "$(header access-control-allow-origin -H "Origin: $W" "$U")"

echo "== $fails FAIL"
[[ $fails -eq 0 ]]
