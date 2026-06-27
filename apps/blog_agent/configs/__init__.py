# configs/__init__.py
"""
Configuration Module

Exports all configuration settings for the application.
"""

# Load .env BEFORE any submodule import. configs/storage.py captures its
# constants at import time, so the .env must be loaded order-independently here
# (configs/env.py's load_dotenv runs too late for storage's module-level reads).
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

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
