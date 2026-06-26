# configs/__init__.py
"""
Configuration Module

Exports all configuration settings for the application.
"""

from configs.aws import *
from configs.database import *
from configs.env import *
from configs.paths import *

__all__ = [
    # Environment
    "NODE_ENV",
    "IS_DEVELOPMENT",
    "IS_PRODUCTION",
    "IS_LOCAL",
    # Database
    "DATABASE_URL",
    "get_database_url",
    # Storage (Supabase, S3-compatible)
    "SUPABASE_S3_ENDPOINT",
    "SUPABASE_S3_REGION",
    "SUPABASE_S3_ACCESS_KEY_ID",
    "SUPABASE_S3_SECRET_ACCESS_KEY",
    "S3_BUCKET",
    "S3_REGION",
    "CDN_ASSET_POSTS",
    # Paths
    "PROJECT_ROOT",
    "POSTS_DIR",
    "TEMP_DIR",
    "LOGS_DIR",
]
