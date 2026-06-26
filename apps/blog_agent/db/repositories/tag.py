# db/repositories/tag.py
"""
Tag Repository

Handles tag and post-tag operations.
Supports UPSERT for tags and linking posts to tags.
"""

from typing import List, Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from db.models import Tag, PostTag
from db.repositories.base import BaseRepository
from utils.snowflake import generate_id


class TagRepository(BaseRepository[Tag]):
    """
    Repository for Tag operations.

    Supports:
    - CRUD operations (inherited)
    - Tag UPSERT
    - Post-tag linking

    Usage:
        async with get_db_session() as session:
            repo = TagRepository(session)
            await repo.link_post_tags(post_id=123, tag_titles=['python', 'ai'])
            await session.commit()
    """

    def __init__(self, session: AsyncSession):
        super().__init__(Tag, session)

    async def get_by_title(self, title: str) -> Optional[Tag]:
        """
        Get tag by title.

        Args:
            title: Tag title (unique).

        Returns:
            Tag or None.
        """
        stmt = select(Tag).where(Tag.title == title).where(Tag.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_or_create(self, title: str) -> Tag:
        """
        Get existing tag or create new one.

        Args:
            title: Tag title.

        Returns:
            Tag (existing or newly created).
        """
        tag = await self.get_by_title(title)
        if tag:
            return tag

        # Create new tag
        tag = Tag(title=title)
        self.session.add(tag)
        await self.session.flush()
        await self.session.refresh(tag)
        return tag

    async def upsert_tags(self, tag_titles: List[str]) -> List[Tag]:
        """
        Upsert multiple tags (create if not exists).

        Args:
            tag_titles: List of tag titles.

        Returns:
            List of tags.
        """
        if not tag_titles:
            return []

        tags = []
        for title in tag_titles:
            title = title.strip().lower()
            if title:
                tag = await self.get_or_create(title)
                tags.append(tag)

        return tags

    async def upsert_tag_raw(self, title: str) -> int:
        """
        Upsert a single tag using raw SQL with Snowflake ID.

        Args:
            title: Tag title (will be normalized to lowercase).

        Returns:
            Tag ID (Snowflake ID for new tags, existing ID for updates).
        """
        title = title.strip().lower()
        if not title:
            raise ValueError("Tag title cannot be empty")

        tag_id = generate_id()

        query = text(
            """
            INSERT INTO tags (id, title)
            VALUES (:id, :title)
            ON CONFLICT (title) DO UPDATE SET
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        """
        )

        result = await self.session.execute(
            query,
            {
                "id": tag_id,
                "title": title,
            },
        )
        return result.scalar_one()

    async def upsert_tags_raw(self, tag_titles: List[str]) -> List[int]:
        """
        Upsert multiple tags using raw SQL with Snowflake IDs.

        Args:
            tag_titles: List of tag titles.

        Returns:
            List of tag IDs.
        """
        if not tag_titles:
            return []

        tag_ids = []
        for title in tag_titles:
            title = title.strip().lower()
            if title:
                tag_id = await self.upsert_tag_raw(title)
                tag_ids.append(tag_id)

        return tag_ids

    async def upsert_and_link_tags(
        self,
        post_id: int,
        tag_titles: List[str],
    ) -> List[str]:
        """
        Upsert tags into tags table and link to post in post_tags.

        Atomic operation:
        1. Upsert each tag into tags table (with Snowflake ID)
        2. Link tag to post in post_tags table

        Args:
            post_id: Post ID to link tags to.
            tag_titles: List of tag titles.

        Returns:
            List of linked tag titles.
        """
        if not tag_titles:
            return []

        linked_titles = []

        for title in tag_titles:
            title = title.strip().lower()
            if not title:
                continue

            # 1. Upsert tag into tags table and get tag_id
            tag_id = await self.upsert_tag_raw(title)

            # 2. Link to post in post_tags (with tag_id)
            link_query = text(
                """
                INSERT INTO post_tags (post_id, tag_id, tag_title)
                VALUES (:post_id, :tag_id, :tag_title)
                ON CONFLICT (post_id, tag_title) DO UPDATE SET
                    tag_id = EXCLUDED.tag_id,
                    updated_at = CURRENT_TIMESTAMP
            """
            )

            await self.session.execute(
                link_query,
                {
                    "post_id": post_id,
                    "tag_id": tag_id,
                    "tag_title": title,
                },
            )
            linked_titles.append(title)

        return linked_titles

    async def link_post_tags(
        self,
        post_id: int,
        tag_titles: List[str],
    ) -> List[str]:
        """
        Link a post to multiple tags.

        Uses raw SQL with ON CONFLICT for upsert.
        Matches the pattern from temp/insert_categories.ts.

        Args:
            post_id: Post ID.
            tag_titles: List of tag titles.

        Returns:
            List of linked tag titles.
        """
        if not tag_titles:
            return []

        linked_titles = []

        query = text(
            """
            INSERT INTO post_tags (post_id, tag_id, tag_title)
            VALUES (:post_id, :tag_id, :tag_title)
            ON CONFLICT (post_id, tag_title) DO UPDATE SET
                tag_id = EXCLUDED.tag_id,
                updated_at = CURRENT_TIMESTAMP
        """
        )

        for title in tag_titles:
            title = title.strip().lower()
            if not title:
                continue

            # First upsert the tag to get tag_id
            tag_id = await self.upsert_tag_raw(title)

            await self.session.execute(
                query,
                {
                    "post_id": post_id,
                    "tag_id": tag_id,
                    "tag_title": title,
                },
            )
            linked_titles.append(title)

        return linked_titles

    async def get_post_tags(self, post_id: int) -> List[str]:
        """
        Get all tag titles for a post.

        Args:
            post_id: Post ID.

        Returns:
            List of tag titles.
        """
        stmt = (
            select(PostTag.tag_title)
            .where(PostTag.post_id == post_id)
            .where(PostTag.deleted_at.is_(None))
        )
        result = await self.session.execute(stmt)
        return [row[0] for row in result.fetchall()]

    async def unlink_post_tag(self, post_id: int, tag_title: str) -> bool:
        """
        Remove a tag link from a post.

        Args:
            post_id: Post ID.
            tag_title: Tag title to remove.

        Returns:
            True if removed, False if not found.
        """
        stmt = (
            select(PostTag).where(PostTag.post_id == post_id).where(PostTag.tag_title == tag_title)
        )
        result = await self.session.execute(stmt)
        post_tag = result.scalar_one_or_none()

        if post_tag:
            await self.session.delete(post_tag)
            return True
        return False

    async def get_popular_tags(self, limit: int = 20) -> List[tuple[str, int]]:
        """
        Get most used tags with counts.

        Args:
            limit: Maximum number of tags.

        Returns:
            List of (tag_title, count) tuples.
        """
        from sqlalchemy import func

        stmt = (
            select(PostTag.tag_title, func.count(PostTag.post_id).label("count"))
            .where(PostTag.deleted_at.is_(None))
            .group_by(PostTag.tag_title)
            .order_by(func.count(PostTag.post_id).desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return [(row[0], row[1]) for row in result.fetchall()]
