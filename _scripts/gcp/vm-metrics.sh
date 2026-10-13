#!/usr/bin/env bash
# Reads VM memory and egress from Cloud Monitoring (deploy/traffic/README.md "Monitoring").
# Read-only. Needs `gcloud auth login` and jq. Usage: vm-metrics.sh [days, default 1]
set -euo pipefail
DAYS=${1:-1}
P=$(gcloud config get-value project 2>/dev/null)
T=$(gcloud auth print-access-token)
S=$(date -u -v-"${DAYS}"d +%FT%TZ)
E=$(date -u +%FT%TZ)

# series <filter> <alignmentPeriod> <aligner> → raw JSON, all series summed
series() {
    curl -s -G -H "Authorization: Bearer $T" "https://monitoring.googleapis.com/v3/projects/$P/timeSeries" \
        --data-urlencode "filter=$1" \
        --data-urlencode "interval.startTime=$S" --data-urlencode "interval.endTime=$E" \
        --data-urlencode "aggregation.alignmentPeriod=$2" --data-urlencode "aggregation.perSeriesAligner=$3" \
        --data-urlencode 'aggregation.crossSeriesReducer=REDUCE_SUM'
}

echo "== memory used, max per hour (alert at 90 %)"
series 'metric.type="agent.googleapis.com/memory/percent_used" AND metric.label.state="used"' 3600s ALIGN_MAX |
    jq -r '.timeSeries[0].points[]? | "\(.interval.endTime)  \(.value.doubleValue*10|round/10) %"'

echo "== VM egress per day (Cloudflare MISS answers + SSR calls)"
series 'metric.type="compute.googleapis.com/instance/network/sent_bytes_count"' 86400s ALIGN_SUM |
    jq -r '.timeSeries[0].points[]? | "\(.interval.endTime)  \((.value.int64Value|tonumber)/1048576|round) MiB"'
