# __tests__/conftest.py
"""Pytest configuration for the blog_agent test suite.

Responsibilities:
    - Exclude manual-run script files from automatic pytest collection so they
      do not surface as fixture-miscollection errors.
    - Provide a shared ``db_available`` guard used by DB-dependent tests to skip
      cleanly when no database connection is reachable.

Constraints:
    - ``db_available`` must remain behaviorally identical to the working copy in
      ``test_tag_integration.py`` so skip behavior stays consistent.

Side effects:
    - ``db_available`` opens a transient database session to run ``SELECT 1``.
"""

import sys
from pathlib import Path

# Add project root to path so test modules can import application packages.
project_root = str(Path(__file__).parent.parent)
sys.path.insert(0, project_root)

# Manual-run scripts (not pytest test modules) — exclude from collection.
collect_ignore = ["test_improved_agents.py", "test_llm_providers.py"]


def db_available() -> bool:
    """Check if database is available.

    Returns:
        True if a ``SELECT 1`` succeeds via ``get_db_session``, False on any
        exception (connection refused, missing config, etc.).
    """
    try:
        import asyncio

        from sqlalchemy import text

        from db import get_db_session

        async def check():
            async with get_db_session() as session:
                result = await session.execute(text("SELECT 1"))
                return result.scalar() == 1

        return asyncio.get_event_loop().run_until_complete(check())
    except Exception:
        return False
