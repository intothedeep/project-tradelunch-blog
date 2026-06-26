# db/repositories/category.py
"""
Category Repository

Handles category operations including hierarchical category insertion.
Translates TypeScript insert_categories.ts logic to Python/SQLAlchemy.
"""

from typing import Optional, List

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from db.models import Category
from db.repositories.base import BaseRepository
from utils.snowflake import generate_id


class CategoryRepository(BaseRepository[Category]):
    """
    Repository for Category operations.
    
    Supports:
    - CRUD operations (inherited)
    - Hierarchical category insertion with parent/group tracking
    - UPSERT with ON CONFLICT handling
    
    Usage:
        async with get_db_session() as session:
            repo = CategoryRepository(session)
            leaf_id = await repo.insert_category_hierarchy(
                categories=['technology', 'ai', 'machine-learning'],
                user_id=2
            )
            await session.commit()
    """
    
    def __init__(self, session: AsyncSession):
        super().__init__(Category, session)
    
    async def get_by_title(self, title: str, user_id: int) -> Optional[Category]:
        """
        Get category by title for a specific user.
        
        Args:
            title: Category title.
            user_id: User ID (categories are unique per user).
        
        Returns:
            Category or None if not found.
        """
        stmt = (
            select(Category)
            .where(Category.title == title)
            .where(Category.user_id == user_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_children(self, parent_id: int) -> List[Category]:
        """
        Get direct children of a category.
        
        Args:
            parent_id: Parent category ID.
        
        Returns:
            List of child categories.
        """
        stmt = (
            select(Category)
            .where(Category.parent_id == parent_id)
            .where(Category.deleted_at.is_(None))
            .order_by(Category.priority, Category.title)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
    
    async def get_roots(self, user_id: Optional[int] = None) -> List[Category]:
        """
        Get root categories (level=0).
        
        Args:
            user_id: Filter by user ID (optional).
        
        Returns:
            List of root categories.
        """
        stmt = (
            select(Category)
            .where(Category.level == 0)
            .where(Category.deleted_at.is_(None))
        )
        if user_id is not None:
            stmt = stmt.where(Category.user_id == user_id)
        
        stmt = stmt.order_by(Category.priority, Category.title)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
    
    async def insert_category_hierarchy(
        self,
        categories: List[str],
        user_id: int,
    ) -> Optional[int]:
        """
        Insert hierarchical categories with proper parent_id, group_id, level.
        
        Uses raw SQL with ON CONFLICT for PostgreSQL upsert.
        Matches the pattern from temp/insert_categories.ts.
        
        Args:
            categories: Hierarchical category names, e.g., ['technology', 'ai', 'ml']
            user_id: User ID who owns these categories.
        
        Returns:
            ID of the leaf (deepest) category, or None if empty.
        """
        if not categories:
            return None
        
        root_name = categories[0]
        children_names = categories[1:]
        
        # 1. Handle root category with raw SQL upsert
        root_id = generate_id()
        
        root_query = text("""
            INSERT INTO categories (id, group_id, title, user_id, level, parent_id) 
            VALUES (:id, :id, :title, :user_id, 0, NULL) 
            ON CONFLICT (user_id, title) DO UPDATE SET
                level = EXCLUDED.level,
                group_id = EXCLUDED.group_id,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        """)
        
        result = await self.session.execute(root_query, {
            "id": root_id,
            "title": root_name,
            "user_id": user_id,
        })
        root_id = result.scalar_one()
        
        # 2. Handle children categories with raw SQL upsert
        parent_id = root_id
        group_id = root_id  # All children share root's ID as group_id
        
        child_query = text("""
            INSERT INTO categories (id, group_id, parent_id, level, title, user_id) 
            VALUES (:id, :group_id, :parent_id, :level, :title, :user_id) 
            ON CONFLICT (user_id, title) DO UPDATE SET
                level = EXCLUDED.level,
                parent_id = EXCLUDED.parent_id,
                group_id = EXCLUDED.group_id,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        """)
        
        for index, child_name in enumerate(children_names):
            level = index + 1
            child_id = generate_id()
            
            result = await self.session.execute(child_query, {
                "id": child_id,
                "group_id": group_id,
                "parent_id": parent_id,
                "level": level,
                "title": child_name,
                "user_id": user_id,
            })
            child_id = result.scalar_one()
            
            # Move to next level
            parent_id = child_id
        
        # Return the leaf category ID
        return parent_id
    
    async def get_hierarchy_path(self, category_id: int) -> List[Category]:
        """
        Get the full path from root to this category.
        
        Args:
            category_id: Target category ID.
        
        Returns:
            List of categories from root to target.
        """
        path = []
        current_id: Optional[int] = category_id
        
        while current_id is not None:
            category = await self.get_by_id(current_id)
            if category is None:
                break
            path.insert(0, category)
            current_id = category.parent_id
        
        return path
    
    async def get_all_descendants(self, category_id: int) -> List[Category]:
        """
        Get all descendants (children, grandchildren, etc.) of a category.
        
        Uses recursive CTE for efficient traversal.
        
        Args:
            category_id: Root category ID.
        
        Returns:
            List of all descendant categories.
        """
        # Use recursive CTE
        cte_query = text("""
            WITH RECURSIVE descendants AS (
                SELECT id, title, parent_id, level
                FROM categories
                WHERE parent_id = :root_id AND deleted_at IS NULL
                
                UNION ALL
                
                SELECT c.id, c.title, c.parent_id, c.level
                FROM categories c
                INNER JOIN descendants d ON c.parent_id = d.id
                WHERE c.deleted_at IS NULL
            )
            SELECT id FROM descendants
        """)
        
        result = await self.session.execute(cte_query, {"root_id": category_id})
        descendant_ids = [row[0] for row in result.fetchall()]
        
        if not descendant_ids:
            return []
        
        # Fetch full category objects
        stmt = select(Category).where(Category.id.in_(descendant_ids))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
