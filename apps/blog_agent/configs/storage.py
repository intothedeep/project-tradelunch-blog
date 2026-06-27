# configs/storage.py
"""
Storage Configuration (native Supabase Storage client)

Reads connection settings for the supabase-py / storage3 native client.
Credentials are the Supabase project URL + secret (service-role) key, NOT AWS
S3 access keys.

Invariants:
- Bucket is `blog.prettylog`.
- Public object URLs resolve as `${CDN_ASSETS}/<key>` (Cloudflare CDN CNAME),
  never the raw `*.supabase.co` path.
Side effects: none (pure env read).
"""

import os

# ==================== Supabase Storage (native client) ====================
# Project Settings -> API. SUPABASE_SECRET_KEY is the service-role/secret key
# (sb_secret_...), required server-side for privileged Storage writes.
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "")

# Storage bucket name (call-site stable).
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "blog.prettylog")

# Documented-but-unused server-side: project ref + client-side publishable key.
# Loaded for completeness; code must not require them.
SUPABASE_PROJECT_ID = os.getenv("SUPABASE_PROJECT_ID", "")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")


# ==================== CDN Configuration ====================
# Public base for stored objects; stored_uri = f"{CDN_ASSETS}/{key}".
CDN_ASSETS = os.getenv("CDN_ASSETS", "https://assets.prettylog.com").rstrip("/")
