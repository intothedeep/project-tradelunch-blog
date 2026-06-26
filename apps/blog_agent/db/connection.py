# db/connection.py
"""
Database Connection Management

Provides async session factory and engine configuration for PostgreSQL.
Uses asyncpg driver with SQLAlchemy 2.x async support.

SSL Configuration (matching TypeScript dialectOptions):
- Development: ssl require, rejectUnauthorized=false
- Production: ssl require, rejectUnauthorized=true with CA cert
"""

import os
import ssl
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# Import config
try:
    from config import (
        DB_PG_HOST,
        DB_PG_PORT,
        DB_PG_DATABASE,
        DB_PG_USER,
        DB_PG_PASSWORD,
        DB_SSL_ENABLED,
        DB_SSL_REJECT_UNAUTHORIZED,
        DB_SSL_CA_PATH,
    )
    from configs.env import IS_PRODUCTION
except ImportError:
    # Fallback to environment variables
    DB_PG_HOST = os.getenv("DB_PG_HOST", "localhost")
    DB_PG_PORT = int(os.getenv("DB_PG_PORT", "5432"))
    DB_PG_DATABASE = os.getenv("DB_PG_DATABASE", "db20250627")
    DB_PG_USER = os.getenv("DB_PG_USER", "super")
    DB_PG_PASSWORD = os.getenv("DB_PG_PASSWORD", "")
    DB_SSL_ENABLED = os.getenv("DB_SSL_ENABLED", "true").lower() == "true"
    DB_SSL_REJECT_UNAUTHORIZED = os.getenv("DB_SSL_REJECT_UNAUTHORIZED", "false").lower() == "true"
    DB_SSL_CA_PATH = os.getenv("DB_SSL_CA_PATH", "")
    IS_PRODUCTION = os.getenv("NODE_ENV", "development") == "production"


def get_database_url() -> str:
    """
    Build async PostgreSQL connection URL from config.
    
    Returns:
        Async-compatible PostgreSQL URL using asyncpg driver.
    """
    # asyncpg driver for async support
    return f"postgresql+asyncpg://{DB_PG_USER}:{DB_PG_PASSWORD}@{DB_PG_HOST}:{DB_PG_PORT}/{DB_PG_DATABASE}"


def get_sync_database_url() -> str:
    """
    Build sync PostgreSQL connection URL (for migrations, etc).
    """
    return f"postgresql+psycopg2://{DB_PG_USER}:{DB_PG_PASSWORD}@{DB_PG_HOST}:{DB_PG_PORT}/{DB_PG_DATABASE}"


def get_ssl_context() -> ssl.SSLContext | str | None:
    """
    Build SSL context for database connection.

    Matches TypeScript dialectOptions.ssl configuration:
    - If SSL disabled: return None
    - Development (rejectUnauthorized=false): return "require"
    - Production (rejectUnauthorized=true): return SSLContext with CA cert

    Returns:
        SSL context, "require" string, or None
    """
    if not DB_SSL_ENABLED:
        return None

    if DB_SSL_REJECT_UNAUTHORIZED and IS_PRODUCTION:
        # Production: strict SSL with CA certificate verification
        # Equivalent to: { ssl: { require: true, rejectUnauthorized: true, ca: ... } }
        ca_path = Path(DB_SSL_CA_PATH)
        if ca_path.exists():
            ssl_context = ssl.create_default_context(cafile=str(ca_path))
            ssl_context.check_hostname = True
            ssl_context.verify_mode = ssl.CERT_REQUIRED
            return ssl_context
        else:
            # CA file not found, fall back to require without verification
            print(f"Warning: SSL CA file not found at {ca_path}, using ssl=require")
            return "require"
    else:
        # Development: SSL required but don't verify certificate
        # Equivalent to: { ssl: { require: true, rejectUnauthorized: false } }
        return "require"


# Global engine instance (lazy initialization)
_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """
    Get or create the async database engine.

    SSL is configured based on environment:
    - Development: ssl=require (no cert verification)
    - Production: ssl with CA cert verification

    Returns:
        Configured AsyncEngine instance.
    """
    global _engine
    if _engine is None:
        # Build connect_args with SSL configuration
        connect_args: dict[str, Any] = {}
        ssl_context = get_ssl_context()
        if ssl_context is not None:
            connect_args["ssl"] = ssl_context

        _engine = create_async_engine(
            get_database_url(),
            echo=os.getenv("DB_ECHO", "false").lower() == "true",
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            connect_args=connect_args,
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """
    Get or create the async session factory.
    
    Returns:
        Configured async_sessionmaker instance.
    """
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _session_factory


# Type alias for database session
DatabaseSession = AsyncSession


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Async context manager for database sessions.
    
    Usage:
        async with get_db_session() as session:
            async with session.begin():
                await session.execute(...)
    
    Yields:
        AsyncSession for database operations.
    """
    session_factory = get_session_factory()
    session = session_factory()
    try:
        yield session
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def close_engine() -> None:
    """Close the database engine and clean up connections."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
