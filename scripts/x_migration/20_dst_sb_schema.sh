#!/usr/bin/env bash
# 20 — Recreate the blog schema on the NEW Supabase project by replaying the
# blog-only migrations in order (finance-numbered files are skipped).
# Replaying (vs -Fc schema restore) keeps RLS/Supabase-native roles exact.
source "$(dirname "$0")/00_env.sh"

MIG="$(cd "$(dirname "$0")/../.." && pwd)/apps/dashboard_server/supabase/migrations"
BLOG_MIGRATIONS=(
  0001_blog_schema.sql
  0002_rls_policies.sql
  0003_clerk_multiuser.sql
  0005_post_status_draft.sql
  0006_post_favorites.sql
  0007_post_favorites_user_created_idx.sql
  0008_post_likes.sql
  0009_comments.sql
  0010_category_unique_parent.sql
  0021_category_title_lowercase.sql
)

for f in "${BLOG_MIGRATIONS[@]}"; do
  echo "── replay $f"
  psql "$DST_SB_NON_POOLING" -v ON_ERROR_STOP=1 -f "$MIG/$f"
done
echo "blog schema replayed on DST-SB. RLS is on 7 original tables only — do NOT add more."
