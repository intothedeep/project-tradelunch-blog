#!/usr/bin/env bash
# 40 — GO/NO-GO gate: row-count diff SRC vs each destination. Nonzero exit on mismatch.
source "$(dirname "$0")/00_env.sh"

cnt() { psql "$1" -tAc "SELECT count(*) FROM $2" 2>/dev/null || echo "ERR"; }

fail=0
printf '%-24s %12s %12s  %s\n' TABLE SRC DST STATUS
echo "── blog → DST-SB ──"
for t in $BLOG_TABLES; do
  s=$(cnt "$SRC_NON_POOLING" "$t"); d=$(cnt "$DST_SB_NON_POOLING" "$t")
  [ "$s" = "$d" ] && st=ok || { st=MISMATCH; fail=1; }
  printf '%-24s %12s %12s  %s\n' "$t" "$s" "$d" "$st"
done
echo "── finance → ORA ──"
for t in $FINANCE_TABLES; do
  s=$(cnt "$SRC_NON_POOLING" "$t"); d=$(cnt "$ORA_DIRECT" "$t")
  [ "$s" = "$d" ] && st=ok || { st=MISMATCH; fail=1; }
  printf '%-24s %12s %12s  %s\n' "$t" "$s" "$d" "$st"
done

[ "$fail" = 0 ] && echo "ALL MATCH — safe to cut over" || { echo "MISMATCH — do NOT cut over"; exit 1; }
