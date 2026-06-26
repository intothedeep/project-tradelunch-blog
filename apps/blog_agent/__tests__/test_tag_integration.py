# __tests__/test_tag_integration.py
"""
Tag Integration Tests

Tests for TagRepository and tag integration in UploadingAgent.

Usage:
    python __tests__/test_tag_integration.py
    pytest __tests__/test_tag_integration.py -v

Note:
    These tests require a database connection. They will be skipped
    if the database is not available.
"""

import asyncio
import sys
from pathlib import Path
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

# Add project root to path
project_root = str(Path(__file__).parent.parent)
sys.path.insert(0, project_root)


def db_available():
    """Check if database is available."""
    try:
        import asyncio
        from db import get_db_session
        from sqlalchemy import text

        async def check():
            async with get_db_session() as session:
                result = await session.execute(text("SELECT 1"))
                return result.scalar() == 1

        return asyncio.get_event_loop().run_until_complete(check())
    except Exception:
        return False


# Mark all tests in this module to require database
pytestmark = pytest.mark.skipif(
    not db_available(),
    reason="Database not available"
)


class TestTagRepository(IsolatedAsyncioTestCase):
    """Test TagRepository methods."""

    async def test_upsert_tag_raw_normalizes_title(self):
        """Test that tag titles are normalized to lowercase."""
        from db import get_db_session, TagRepository

        async with get_db_session() as session:
            repo = TagRepository(session)

            # Upsert with mixed case
            tag_id = await repo.upsert_tag_raw("Python")

            # Should return an integer ID
            self.assertIsInstance(tag_id, int)
            self.assertGreater(tag_id, 0)

            # Rollback to avoid persisting test data
            await session.rollback()

    async def test_upsert_tag_raw_empty_title_raises(self):
        """Test that empty tag title raises ValueError."""
        from db import get_db_session, TagRepository

        async with get_db_session() as session:
            repo = TagRepository(session)

            with self.assertRaises(ValueError):
                await repo.upsert_tag_raw("")

            with self.assertRaises(ValueError):
                await repo.upsert_tag_raw("   ")

            await session.rollback()

    async def test_upsert_tags_raw_multiple(self):
        """Test upserting multiple tags."""
        from db import get_db_session, TagRepository

        async with get_db_session() as session:
            repo = TagRepository(session)

            tag_titles = ["python", "ai", "machine-learning"]
            tag_ids = await repo.upsert_tags_raw(tag_titles)

            self.assertEqual(len(tag_ids), 3)
            for tag_id in tag_ids:
                self.assertIsInstance(tag_id, int)
                self.assertGreater(tag_id, 0)

            await session.rollback()

    async def test_upsert_tags_raw_empty_list(self):
        """Test upserting empty tag list."""
        from db import get_db_session, TagRepository

        async with get_db_session() as session:
            repo = TagRepository(session)

            tag_ids = await repo.upsert_tags_raw([])

            self.assertEqual(tag_ids, [])
            await session.rollback()

    async def test_upsert_and_link_tags(self):
        """Test upserting and linking tags to a post."""
        from db import get_db_session, TagRepository, PostRepository
        import config

        async with get_db_session() as session:
            # First create a test post
            post_repo = PostRepository(session)
            post_id = await post_repo.upsert_post(
                user_id=config.DEFAULT_USER_ID,
                title="Test Post for Tags",
                slug="test-post-for-tags",
                content="Test content",
                description="Test description",
            )

            # Now test tag linking
            tag_repo = TagRepository(session)
            tag_titles = ["python", "testing", "integration"]
            linked_tags = await tag_repo.upsert_and_link_tags(post_id, tag_titles)

            self.assertEqual(len(linked_tags), 3)
            self.assertIn("python", linked_tags)
            self.assertIn("testing", linked_tags)
            self.assertIn("integration", linked_tags)

            # Verify tags are linked by getting post tags
            post_tags = await tag_repo.get_post_tags(post_id)
            self.assertEqual(set(post_tags), set(linked_tags))

            await session.rollback()

    async def test_upsert_and_link_tags_empty(self):
        """Test linking empty tag list to a post."""
        from db import get_db_session, TagRepository

        async with get_db_session() as session:
            repo = TagRepository(session)

            linked_tags = await repo.upsert_and_link_tags(123456789, [])

            self.assertEqual(linked_tags, [])
            await session.rollback()

    async def test_upsert_and_link_tags_normalizes(self):
        """Test that linked tags are normalized to lowercase."""
        from db import get_db_session, TagRepository, PostRepository
        import config

        async with get_db_session() as session:
            # Create test post
            post_repo = PostRepository(session)
            post_id = await post_repo.upsert_post(
                user_id=config.DEFAULT_USER_ID,
                title="Test Post Normalization",
                slug="test-post-normalization",
                content="Test content",
            )

            tag_repo = TagRepository(session)
            tag_titles = ["PYTHON", "  MachineLearning  ", "AI"]
            linked_tags = await tag_repo.upsert_and_link_tags(post_id, tag_titles)

            # All should be lowercase and trimmed
            self.assertIn("python", linked_tags)
            self.assertIn("machinelearning", linked_tags)
            self.assertIn("ai", linked_tags)

            await session.rollback()


class TestUploadingAgentTagIntegration(IsolatedAsyncioTestCase):
    """Test tag integration in UploadingAgent."""

    def setUp(self):
        """Set up test fixtures."""
        from agents.uploading_agent import UploadingAgent
        self.agent = UploadingAgent()

    async def test_save_article_with_tags(self):
        """Test that _save_article processes tags correctly."""
        import config

        # Create test data with tags
        test_data = {
            "title": "Test Article with Tags",
            "slug": "test-article-with-tags",
            "content": "This is test content for tag integration.",
            "user_id": config.DEFAULT_USER_ID,
            "tags": ["python", "testing", "blog"],
            "categories": [],
            "images": [],
            "thumbnail": None,
        }

        # Execute save_article
        result = await self.agent._save_article(test_data)

        # Should succeed
        self.assertTrue(result.get("success"), f"Save failed: {result.get('error')}")
        self.assertIn("article_id", result.get("data", {}))

    async def test_save_article_without_tags(self):
        """Test that _save_article works without tags."""
        import config

        test_data = {
            "title": "Test Article No Tags",
            "slug": "test-article-no-tags",
            "content": "Content without tags.",
            "user_id": config.DEFAULT_USER_ID,
            "tags": [],
            "categories": [],
            "images": [],
            "thumbnail": None,
        }

        result = await self.agent._save_article(test_data)

        self.assertTrue(result.get("success"), f"Save failed: {result.get('error')}")

    async def test_save_article_with_none_tags(self):
        """Test that _save_article handles None tags."""
        import config

        test_data = {
            "title": "Test Article None Tags",
            "slug": "test-article-none-tags",
            "content": "Content with None tags.",
            "user_id": config.DEFAULT_USER_ID,
            # No 'tags' key at all
            "categories": [],
            "images": [],
            "thumbnail": None,
        }

        result = await self.agent._save_article(test_data)

        self.assertTrue(result.get("success"), f"Save failed: {result.get('error')}")


class TestTagRepositoryIdempotency(IsolatedAsyncioTestCase):
    """Test that tag operations are idempotent."""

    async def test_upsert_same_tag_twice_returns_same_id(self):
        """Test that upserting same tag twice returns same ID."""
        from db import get_db_session, TagRepository

        async with get_db_session() as session:
            repo = TagRepository(session)

            # Upsert twice
            id1 = await repo.upsert_tag_raw("python")
            id2 = await repo.upsert_tag_raw("python")

            # Should return same ID (ON CONFLICT returns existing id)
            self.assertEqual(id1, id2)

            await session.rollback()

    async def test_link_same_tag_twice_no_duplicate(self):
        """Test that linking same tag twice doesn't create duplicate."""
        from db import get_db_session, TagRepository, PostRepository
        import config

        async with get_db_session() as session:
            # Create test post
            post_repo = PostRepository(session)
            post_id = await post_repo.upsert_post(
                user_id=config.DEFAULT_USER_ID,
                title="Test Idempotency",
                slug="test-idempotency",
                content="Test content",
            )

            tag_repo = TagRepository(session)

            # Link same tags twice
            await tag_repo.upsert_and_link_tags(post_id, ["python", "ai"])
            await tag_repo.upsert_and_link_tags(post_id, ["python", "ai"])

            # Should only have 2 unique tags
            post_tags = await tag_repo.get_post_tags(post_id)
            self.assertEqual(len(post_tags), 2)

            await session.rollback()


if __name__ == "__main__":
    import unittest
    unittest.main()
