# configs/database.py
"""
Database Configuration

PostgreSQL connection settings matching TypeScript env.schema.ts.
"""

import os
from pathlib import Path


# ==================== PostgreSQL Database ====================
# Uses DB_PG_* naming convention to match TypeScript

DB_PG_HOST = os.getenv("DB_PG_HOST", "localhost")
DB_PG_PORT = int(os.getenv("DB_PG_PORT", "5432"))
DB_PG_DATABASE = os.getenv("DB_PG_DATABASE", "db20250627")
DB_PG_USER = os.getenv("DB_PG_USER", "super")
DB_PG_PASSWORD = os.getenv("DB_PG_PASSWORD", "")


# ==================== SSL Configuration ====================
# Matches TypeScript dialectOptions.ssl

DB_SSL_ENABLED = os.getenv("DB_SSL_ENABLED", "true").lower() == "true"
DB_SSL_REJECT_UNAUTHORIZED = os.getenv("DB_SSL_REJECT_UNAUTHORIZED", "false").lower() == "true"

# Path to RDS CA certificate (for production with strict SSL)
# Default: configs/certs/rds-combined-ca-bundle.pem
DB_SSL_CA_PATH = os.getenv(
    "DB_SSL_CA_PATH",
    str(Path(__file__).parent / "certs" / "rds-combined-ca-bundle.pem")
)

# DB_CONFIG dict for legacy compatibility
DB_CONFIG = {
    "host": DB_PG_HOST,
    "port": DB_PG_PORT,
    "database": DB_PG_DATABASE,
    "user": DB_PG_USER,
    "password": DB_PG_PASSWORD,
}


# ==================== EC2 / SSH Tunnel ====================
# Only needed for development with SSH tunnel to RDS

EC2_HOST = os.getenv("EC2_HOST", "")
EC2_PORT = int(os.getenv("EC2_PORT", "22"))
EC2_USERNAME = os.getenv("EC2_USERNAME", "ec2-user")


def get_database_url(async_driver: bool = True) -> str:
    """
    Build PostgreSQL connection URL.
    
    Args:
        async_driver: Use asyncpg (True) or psycopg2 (False)
    
    Returns:
        PostgreSQL connection URL
    """
    driver = "postgresql+asyncpg" if async_driver else "postgresql+psycopg2"
    return f"{driver}://{DB_PG_USER}:{DB_PG_PASSWORD}@{DB_PG_HOST}:{DB_PG_PORT}/{DB_PG_DATABASE}"
