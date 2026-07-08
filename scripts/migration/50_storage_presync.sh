#!/usr/bin/env bash
# 50 — Pre-copy ALL buckets Supabase → Oracle Object Storage while prod still reads
# from Supabase (no downtime). Run again as 51 at cutover to catch the delta.
# Requires ~/.config/rclone/rclone.conf with two S3 remotes (see below).
source "$(dirname "$0")/00_env.sh"

# One-time rclone remote setup (writes to rclone.conf):
#   rclone config create src-sb s3 provider Other \
#     endpoint "$SB_S3_ENDPOINT"  region "$SB_S3_REGION" \
#     access_key_id "$SB_S3_ACCESS_KEY_ID" secret_access_key "$SB_S3_SECRET_ACCESS_KEY"
#   rclone config create oci s3 provider Other \
#     endpoint "$OCI_S3_ENDPOINT" region "$OCI_S3_REGION" \
#     access_key_id "$OCI_S3_ACCESS_KEY_ID" secret_access_key "$OCI_S3_SECRET_ACCESS_KEY"

for b in $BUCKETS; do
  echo "── sync $b"
  rclone sync "src-sb:$b" "oci:$b" --progress --transfers 8 --checkers 16
done
echo "pre-sync done. Create OCI buckets first: blog.prettylog=public read, market/sec-archive=private."
