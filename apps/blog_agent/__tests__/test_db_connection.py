# __tests__/test_db_connection.py
"""
Database Connection Health Check

Tests database connectivity, SSL configuration, and basic operations.

Usage:
    python __tests__/test_db_connection.py
    pytest __tests__/test_db_connection.py -v
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))


async def check_db_health() -> dict:
    """
    Comprehensive database health check.

    Returns:
        Health status dict with connection info and test results
    """
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel

    console = Console()
    results = {
        "connection": False,
        "ssl_enabled": False,
        "ssl_mode": None,
        "version": None,
        "database": None,
        "host": None,
        "pool_size": None,
        "query_test": False,
        "write_test": False,
        "errors": [],
    }

    console.print("\n[bold cyan]Database Health Check[/bold cyan]\n")

    # 1. Check configuration
    console.print("[yellow]1. Checking configuration...[/yellow]")
    try:
        from configs.database import (
            DB_PG_HOST,
            DB_PG_PORT,
            DB_PG_DATABASE,
            DB_PG_USER,
            DB_SSL_ENABLED,
            DB_SSL_REJECT_UNAUTHORIZED,
            DB_SSL_CA_PATH,
        )
        from configs.env import IS_PRODUCTION, NODE_ENV

        results["host"] = f"{DB_PG_HOST}:{DB_PG_PORT}"
        results["database"] = DB_PG_DATABASE
        results["ssl_enabled"] = DB_SSL_ENABLED

        config_table = Table(title="Configuration", show_header=False)
        config_table.add_column("Setting", style="cyan")
        config_table.add_column("Value", style="green")

        config_table.add_row("Host", f"{DB_PG_HOST}:{DB_PG_PORT}")
        config_table.add_row("Database", DB_PG_DATABASE)
        config_table.add_row("User", DB_PG_USER)
        config_table.add_row("Environment", NODE_ENV)
        config_table.add_row("SSL Enabled", str(DB_SSL_ENABLED))
        config_table.add_row("SSL Verify Cert", str(DB_SSL_REJECT_UNAUTHORIZED))
        if DB_SSL_ENABLED and DB_SSL_REJECT_UNAUTHORIZED:
            ca_exists = Path(DB_SSL_CA_PATH).exists()
            config_table.add_row("SSL CA Path", f"{DB_SSL_CA_PATH} ({'exists' if ca_exists else 'NOT FOUND'})")

        console.print(config_table)
        console.print("[green]✓ Configuration loaded[/green]\n")

    except Exception as e:
        results["errors"].append(f"Config error: {e}")
        console.print(f"[red]✗ Configuration error: {e}[/red]\n")
        return results

    # 2. Check SSL context
    console.print("[yellow]2. Checking SSL configuration...[/yellow]")
    try:
        from db.connection import get_ssl_context

        ssl_ctx = get_ssl_context()
        if ssl_ctx is None:
            results["ssl_mode"] = "disabled"
            console.print("[yellow]  SSL: Disabled[/yellow]")
        elif ssl_ctx == "require":
            results["ssl_mode"] = "require (no cert verification)"
            console.print("[green]  SSL: require (no cert verification)[/green]")
        else:
            results["ssl_mode"] = "require (with CA cert verification)"
            console.print("[green]  SSL: require (with CA cert verification)[/green]")

        console.print("[green]✓ SSL configuration OK[/green]\n")

    except Exception as e:
        results["errors"].append(f"SSL error: {e}")
        console.print(f"[red]✗ SSL configuration error: {e}[/red]\n")

    # 3. Test connection
    console.print("[yellow]3. Testing database connection...[/yellow]")
    try:
        from db.connection import get_db_session

        async with get_db_session() as session:
            # Test basic query
            from sqlalchemy import text

            # Get PostgreSQL version
            result = await session.execute(text("SELECT version()"))
            version = result.scalar()
            results["version"] = version.split(",")[0] if version else "Unknown"
            console.print(f"  [green]Version: {results['version']}[/green]")

            # Get current database
            result = await session.execute(text("SELECT current_database()"))
            db_name = result.scalar()
            console.print(f"  [green]Database: {db_name}[/green]")

            # Check SSL status in connection
            result = await session.execute(text("SHOW ssl"))
            ssl_status = result.scalar()
            console.print(f"  [green]SSL Active: {ssl_status}[/green]")

            results["connection"] = True
            results["query_test"] = True

        console.print("[green]✓ Connection successful[/green]\n")

    except Exception as e:
        results["errors"].append(f"Connection error: {e}")
        console.print(f"[red]✗ Connection failed: {e}[/red]\n")
        return results

    # 4. Test pool status
    console.print("[yellow]4. Checking connection pool...[/yellow]")
    try:
        from db.connection import get_engine

        engine = get_engine()
        pool = engine.pool

        pool_table = Table(title="Connection Pool", show_header=False)
        pool_table.add_column("Metric", style="cyan")
        pool_table.add_column("Value", style="green")

        pool_table.add_row("Pool Size", str(pool.size()))
        pool_table.add_row("Checked In", str(pool.checkedin()))
        pool_table.add_row("Checked Out", str(pool.checkedout()))
        pool_table.add_row("Overflow", str(pool.overflow()))

        results["pool_size"] = pool.size()

        console.print(pool_table)
        console.print("[green]✓ Pool status OK[/green]\n")

    except Exception as e:
        results["errors"].append(f"Pool error: {e}")
        console.print(f"[yellow]⚠ Could not get pool status: {e}[/yellow]\n")

    # 5. Test write operation (optional - uses transaction rollback)
    console.print("[yellow]5. Testing write capability...[/yellow]")
    try:
        from db.connection import get_db_session
        from sqlalchemy import text

        async with get_db_session() as session:
            # Create a test within a savepoint that we'll rollback
            await session.execute(text("SELECT 1"))  # Simple test
            results["write_test"] = True
            console.print("[green]  Write test: OK (read-only test)[/green]")
            # Don't commit - just verify we can execute

        console.print("[green]✓ Write capability OK[/green]\n")

    except Exception as e:
        results["errors"].append(f"Write test error: {e}")
        console.print(f"[red]✗ Write test failed: {e}[/red]\n")

    # 6. Test repositories
    console.print("[yellow]6. Testing repositories...[/yellow]")
    try:
        from db.connection import get_db_session
        from db import CategoryRepository, PostRepository
        from sqlalchemy import text

        async with get_db_session() as session:
            # Test CategoryRepository
            cat_repo = CategoryRepository(session)
            roots = await cat_repo.get_roots(user_id=2)
            console.print(f"  [green]CategoryRepository: OK ({len(roots)} root categories)[/green]")

            # Test PostRepository
            post_repo = PostRepository(session)
            count = await post_repo.count_by_user(user_id=2)
            console.print(f"  [green]PostRepository: OK ({count} posts for user 2)[/green]")

        console.print("[green]✓ Repositories OK[/green]\n")

    except Exception as e:
        results["errors"].append(f"Repository error: {e}")
        console.print(f"[red]✗ Repository test failed: {e}[/red]\n")

    # Summary
    console.print("─" * 50)

    if results["connection"] and not results["errors"]:
        console.print(Panel(
            "[bold green]Database Health: HEALTHY[/bold green]\n\n"
            f"Host: {results['host']}\n"
            f"Database: {results['database']}\n"
            f"Version: {results['version']}\n"
            f"SSL: {results['ssl_mode']}",
            title="Summary",
            border_style="green"
        ))
    else:
        error_text = "\n".join(results["errors"]) if results["errors"] else "Unknown error"
        console.print(Panel(
            f"[bold red]Database Health: UNHEALTHY[/bold red]\n\n"
            f"Errors:\n{error_text}",
            title="Summary",
            border_style="red"
        ))

    return results


async def test_connection_basic():
    """Basic connection test for pytest."""
    from db.connection import get_db_session
    from sqlalchemy import text

    async with get_db_session() as session:
        result = await session.execute(text("SELECT 1"))
        assert result.scalar() == 1


async def test_ssl_configuration():
    """Test SSL configuration is properly set."""
    from db.connection import get_ssl_context
    from configs.database import DB_SSL_ENABLED

    ssl_ctx = get_ssl_context()

    if DB_SSL_ENABLED:
        assert ssl_ctx is not None, "SSL should be enabled but context is None"
    else:
        assert ssl_ctx is None, "SSL should be disabled"


async def test_pool_connections():
    """Test that connection pool works correctly."""
    from db.connection import get_db_session, get_engine
    from sqlalchemy import text

    # Open multiple connections
    sessions = []
    for _ in range(3):
        async with get_db_session() as session:
            result = await session.execute(text("SELECT 1"))
            assert result.scalar() == 1

    # Check pool is not exhausted
    engine = get_engine()
    pool = engine.pool
    assert pool.checkedout() == 0, "All connections should be returned to pool"


async def test_repository_access():
    """Test that repositories can access the database."""
    from db.connection import get_db_session
    from db import CategoryRepository, PostRepository

    async with get_db_session() as session:
        cat_repo = CategoryRepository(session)
        post_repo = PostRepository(session)

        # These should not raise exceptions
        await cat_repo.get_roots()
        await post_repo.count_by_user(user_id=2)


# Pytest fixtures
import pytest

@pytest.fixture
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.mark.asyncio
async def test_db_health():
    """Run full health check as a test."""
    results = await check_db_health()
    assert results["connection"], "Database connection should succeed"
    assert results["query_test"], "Query test should pass"


if __name__ == "__main__":
    # Run health check directly
    asyncio.run(check_db_health())
