#!/usr/bin/env bash
# Saves day-by-day Cloudflare data for deploy/traffic/review/history. Read-only.
# Needs Zone → Analytics → Read. Client IPs are replaced by labels before saving.
#   ./_scripts/cloudflare/traffic-history-fetch.sh 2026-10-13 2026-11-01
set -euo pipefail
FROM=${1:?from date}; TO=${2:?to date}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$ROOT/deploy/traffic/review/history"
set -a; source "$ROOT/_scripts/cloudflare/.env"; set +a
API=https://api.cloudflare.com/client/v4
gql() { jq -n --arg q "$1" --arg z "$CLOUDFLARE_ZONE_ID" '{query:$q,variables:{z:$z}}' \
  | curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'Content-Type: application/json' --data @- "$API/graphql"; }

gql "query(\$z:String!){viewer{zones(filter:{zoneTag:\$z}){httpRequests1dGroups(limit:60,orderBy:[date_ASC],filter:{date_geq:\"$FROM\",date_leq:\"$TO\"}){dimensions{date} uniq{uniques} sum{requests cachedRequests bytes cachedBytes threats responseStatusMap{edgeResponseStatus requests} countryMap{clientCountryName requests}}}}}}" > "$OUT/daily.json"

# Rate-limit blocks: the API keeps a short window, so an older FROM is cut by retention.
gql "query(\$z:String!){viewer{zones(filter:{zoneTag:\$z}){firewallEventsAdaptive(limit:10000,orderBy:[datetime_ASC],filter:{datetime_geq:\"${FROM}T00:00:00Z\",datetime_leq:\"${TO}T23:59:59Z\",source:\"ratelimit\"}){datetime action clientIP clientRequestHTTPHost clientRequestPath clientCountryName userAgent}}}}" \
  | jq '.errors as $e | if $e then {errors:$e} else (.data.viewer.zones[0].firewallEventsAdaptive) as $r
      | ($r|map(.clientIP)|unique) as $ips
      | {events:($r|map(. as $x | ($ips|index($x.clientIP)) as $i | del(.clientIP) + {client:("C"+($i+1|tostring))}))} end' \
  > "$OUT/ratelimit.json"
jq -c '.errors // {days:(.data.viewer.zones[0].httpRequests1dGroups|length),first:.data.viewer.zones[0].httpRequests1dGroups[0].dimensions.date,last:.data.viewer.zones[0].httpRequests1dGroups[-1].dimensions.date}' "$OUT/daily.json"
jq -c '.errors // {events:(.events|length),first:.events[0].datetime,last:.events[-1].datetime,clients:(.events|map(.client)|unique|length)}' "$OUT/ratelimit.json"

# Per-day breakdowns. One aliased query per day. Query strings and IPs are not requested.
: > "$OUT/adaptive.jsonl"
d=$FROM
while [[ "$d" < "$TO" || "$d" == "$TO" ]]; do
  n=$(date -j -v+1d -f %Y-%m-%d "$d" +%Y-%m-%d)
  W="datetime_geq:\"${d}T00:00:00Z\",datetime_lt:\"${n}T00:00:00Z\""
  g() { echo "$1:httpRequestsAdaptiveGroups(limit:$2,orderBy:[count_DESC],filter:{$W$3}){count sum{edgeResponseBytes} dimensions{$4}}"; }
  Q="query(\$z:String!){viewer{zones(filter:{zoneTag:\$z}){
    $(g host 10 '' clientRequestHTTPHost) $(g path 12 '' clientRequestPath) $(g ua 8 '' userAgent)
    $(g status 12 '' edgeResponseStatus) $(g cache 8 '' cacheStatus) $(g hour 24 '' datetimeHour)
    $(g node 1 ',userAgent:"node"' userAgent)
    $(g meta 1 ',userAgent_like:"%meta-webindexer%"' edgeResponseStatus)
    $(g metaAll 12 ',userAgent_like:"%meta-webindexer%"' edgeResponseStatus)
    $(g h429 6 ',edgeResponseStatus:429' clientRequestHTTPHost) $(g p429 6 ',edgeResponseStatus:429' clientRequestPath) $(g u429 5 ',edgeResponseStatus:429' userAgent)
  }}}"
  gql "$Q" | jq -c --arg d "$d" '{date:$d,errors:(.errors // null|if . then .[0].message else null end),g:.data.viewer.zones[0]}' >> "$OUT/adaptive.jsonl"
  d=$n
done
jq -c '{date,err:(.errors|tostring|.[0:90]),hosts:(.g.host|length)}' "$OUT/adaptive.jsonl" | head -3
