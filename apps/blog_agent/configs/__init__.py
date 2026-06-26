# configs/__init__.py
"""
Configuration Module

Exports all configuration settings for the application.
"""

from configs.storage import *
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
    # Storage (Supabase native client)
    "SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_STORAGE_BUCKET",
    "CDN_ASSETS",
    # Paths
    "PROJECT_ROOT",
    "POSTS_DIR",
    "TEMP_DIR",
    "LOGS_DIR",
]
