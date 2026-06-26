# configs/aws.py
"""
Storage Configuration (Supabase Storage, S3-compatible)

Points the boto3 client at Supabase Storage's S3 endpoint. Credentials are the
Supabase S3 access keys (Project Settings → Storage → S3 access keys), NOT AWS.

Invariants:
- Bucket is `blog-images`.
- Public object URLs resolve as `${CDN_ASSET_POSTS}/<key>`.
Side effects: none (pure env read).
"""

import os

# ==================== Supabase Storage (S3-compatible) ====================
# e.g. https://<project-ref>.storage.supabase.co/storage/v1/s3
SUPABASE_S3_ENDPOINT = os.getenv("SUPABASE_S3_ENDPOINT", "")
SUPABASE_S3_REGION = os.getenv("SUPABASE_S3_REGION", "us-east-1")
SUPABASE_S3_ACCESS_KEY_ID = os.getenv("SUPABASE_S3_ACCESS_KEY_ID", "")
SUPABASE_S3_SECRET_ACCESS_KEY = os.getenv("SUPABASE_S3_SECRET_ACCESS_KEY", "")


# ==================== Bucket ====================
# Stable names kept for call-site compatibility (db/s3.py, configs/__init__.py).
S3_BUCKET = os.getenv("SUPABASE_S3_BUCKET", "blog-images")
S3_REGION = SUPABASE_S3_REGION


# ==================== CDN Configuration ====================
# Public base for stored objects; stored_uri = f"{CDN_ASSET_POSTS}/{key}".
CDN_ASSET_POSTS = os.getenv("CDN_ASSET_POSTS", "https://posts.prettylog.com")
