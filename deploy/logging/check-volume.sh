#!/usr/bin/env bash
# Usage: deploy/logging/check-volume.sh [freshness]   (default 7d)
# Counts Cloud Logging entries per source for the VM and estimates their size.
# Read-only. Runs on the owner's Mac with gcloud logged in. See README "Volume and noise".
set -euo pipefail

fresh="${1:-7d}"
cap=50000   # per query; a count at the cap means "at least"

count() {
    gcloud logging read "$1" --freshness="$fresh" --limit="$cap" --format='value(timestamp)' 2>/dev/null | wc -l | tr -d ' '
}
bytes() {
    gcloud logging read "$1" --freshness="$fresh" --limit="$cap" --format=json 2>/dev/null | wc -c | tr -d ' '
}

echo "Cloud Logging volume, last $fresh (cap $cap per row)"
printf '%-12s %10s %12s\n' source entries approx_MB
total_mb=0
for src in 'blog-api|log_id("blog-api")' \
           'syslog|log_id("syslog")' \
           'ops-agent|log_id("ops-agent-fluent-bit") OR log_id("ops-agent-health")' \
           'other|resource.type="gce_instance" AND NOT log_id("blog-api") AND NOT log_id("syslog") AND NOT log_id("ops-agent-fluent-bit") AND NOT log_id("ops-agent-health")'; do
    name="${src%%|*}"
    q="${src#*|}"
    n="$(count "$q")"
    b="$(bytes "$q")"
    mb="$(awk -v b="$b" 'BEGIN{printf "%.1f", b/1048576}')"
    total_mb="$(awk -v a="$total_mb" -v b="$mb" 'BEGIN{printf "%.1f", a+b}')"
    printf '%-12s %10s %12s\n' "$name" "$n" "$mb"
done

echo
echo "Top syslog senders:"
gcloud logging read 'log_id("syslog")' --freshness="$fresh" --limit=5000 --format='value(jsonPayload.message)' 2>/dev/null \
    | awk '{print $3}' | sed -E 's/\[[0-9]+\]:?//' | sort | uniq -c | sort -rn | head -8

echo
echo "blog-api by severity:"
sev="$(gcloud logging read 'log_id("blog-api")' --freshness="$fresh" --limit="$cap" --format='value(severity)' 2>/dev/null)"
echo "$sev" | sort | uniq -c | sort -rn

# Machine-readable tail, read by .github/workflows/logging-review.yml
echo
echo "TOTAL_MB=$total_mb"
echo "BLOG_API_ERRORS=$(echo "$sev" | grep -c '^ERROR$' || true)"
