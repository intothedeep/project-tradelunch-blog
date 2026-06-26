# configs/__init__.py
"""
Configuration Module

Exports all configuration settings for the application.
"""

from configs.env import *
from configs.database import *
from configs.aws import *
from configs.paths import *

__all__ = [
    # Environment
    "NODE_ENV",
    "IS_DEVELOPMENT",
    "IS_PRODUCTION",
    "IS_LOCAL",
    # Database
    "DB_PG_HOST",
    "DB_PG_PORT",
    "DB_PG_DATABASE",
    "DB_PG_USER",
    "DB_PG_PASSWORD",
    "DB_CONFIG",
    # AWS
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "S3_BUCKET",
    "S3_REGION",
    "CDN_ASSET_POSTS",
    # Paths
    "PROJECT_ROOT",
    "POSTS_DIR",
    "TEMP_DIR",
    "LOGS_DIR",
]
