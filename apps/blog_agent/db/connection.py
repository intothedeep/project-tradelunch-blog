# db/connection.py
"""
Database Connection Management

Provides async session factory and engine configuration for PostgreSQL.
Uses the asyncpg driver with SQLAlchemy 2.x async support.

Connection target: Supabase via resolved Postgres URL (direct preferred).
SSL mirrors the TS server's `rejectUnauthorized: false` — a context with
hostname/cert verification disabled (no CA bundle, no RDS logic).

Public interface (stable for call-sites):
    get_db_session, get_engine, get_session_factory, DatabaseSession, close_engine
Side effects: creates a process-global async engine on first use.
"""

import os
import ssl
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from configs.database import get_database_url


def get_ssl_context() -> ssl.SSLContext:
    """Build a non-verifying SSL context for the Supabase pooler.

    Equivalent to TS `ssl: { require: true, rejectUnauthorized: false }`:
    TLS is used, but neither hostname nor certificate chain is verified.

    Returns:
        An ``ssl.SSLContext`` with ``check_hostname=False`` and
        ``verify_mode=CERT_NONE``.
    """
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


# Global engine instance (lazy initialization)
_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """Get or create the async database engine.

    Returns:
        Configured AsyncEngine bound to the resolved Postgres URL (direct
        preferred) with non-verifying SSL.
    """
    global _engine
    if _engine is None:
        connect_args: dict[str, Any] = {"ssl": get_ssl_context()}
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
    """Get or create the async session factory.

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
    """Async context manager for database sessions.

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
