#!/usr/bin/env bash
# 51 — Final delta re-sync at cutover (run right before flipping the Cloudflare origin).
source "$(dirname "$0")/00_env.sh"
for b in $BUCKETS; do
  echo "── re-sync $b"
  rclone sync "src-sb:$b" "oci:$b" --progress --transfers 8 --checkers 16
done
cat <<'EOF'
Now:
  1. Repoint Cloudflare assets.prettylog.com origin: Supabase /storage/v1/object/public/{bucket}/{path}
     → OCI /{namespace}/b/{bucket}/o/{path} (or PAR base). Keep CDN_ASSETS value unchanged.
  2. Purge Cloudflare cache.
  3. Deploy the 3 storage-code changes (uploadImage.ts / storage.py / storage_sink.py) + OCI_S3_* env.
EOF
