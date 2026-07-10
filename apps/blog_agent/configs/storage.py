# configs/storage.py
"""
Storage Configuration — provider-agnostic STORAGE_* env vars + legacy Supabase keys.

WHY: Centralises all storage credentials so the factory and providers read from
one place. ``STORAGE_PROVIDER`` selects the backend at runtime; the remaining
``STORAGE_*`` keys feed the active provider.

CONTRACT: See apps/dashboard_server/src/lib/storage/CONTRACT.md §5 (env matrix).

Side effects: none (pure env read).
"""

import os

# ==================== Provider selector ====================
# CONTRACT.md §5: 'supabase' (default) | 'oci' | 's3'
STORAGE_PROVIDER: str = os.getenv("STORAGE_PROVIDER", "supabase")

# ==================== OCI / S3 credentials ====================
# Used when STORAGE_PROVIDER is 'oci' or 's3'.
STORAGE_ENDPOINT: str = os.getenv("STORAGE_ENDPOINT", "")
STORAGE_ACCESS_KEY: str = os.getenv("STORAGE_ACCESS_KEY", "")
STORAGE_SECRET_KEY: str = os.getenv("STORAGE_SECRET_KEY", "")
STORAGE_REGION: str = os.getenv("STORAGE_REGION", "")

# ==================== Bucket name ====================
# OCI bucket name. The bucket is still needed for uploads (provider.put Bucket=),
# but it no longer appears in the public URL (see CDN configuration below).
STORAGE_BUCKET: str = os.getenv("STORAGE_BUCKET", "blog-assets.prettylog.com")

# ==================== Supabase Storage (native client) ====================
# Project Settings -> API. SUPABASE_SECRET_KEY is the service-role/secret key
# (sb_secret_...), required server-side for privileged Storage writes.
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_SECRET_KEY: str = os.getenv("SUPABASE_SECRET_KEY", "")

# Supabase's own bucket name. Decoupled from STORAGE_BUCKET: the OCI bucket was
# renamed to 'blog-assets.prettylog.com' while the Supabase bucket remains
# 'blog.prettylog'. Do NOT fall back to STORAGE_BUCKET here.
SUPABASE_STORAGE_BUCKET: str = os.getenv("SUPABASE_STORAGE_BUCKET", "blog.prettylog")

# Documented-but-unused server-side: project ref + client-side publishable key.
# Loaded for completeness; code must not require them.
SUPABASE_PROJECT_ID: str = os.getenv("SUPABASE_PROJECT_ID", "")
SUPABASE_PUBLISHABLE_KEY: str = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")

# ==================== CDN Configuration ====================
# Public base for stored objects; stored_uri = build_public_url(CDN_ASSETS, key).
# The bucket segment is NOT part of the URL — the CDN CNAME resolves directly to
# the bucket origin, so only the object key is appended.
CDN_ASSETS: str = os.getenv("CDN_ASSETS", "https://blog-assets.prettylog.com").rstrip("/")
