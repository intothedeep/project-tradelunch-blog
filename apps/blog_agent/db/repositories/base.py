# db/repositories/base.py
"""
Base Repository

Generic base repository with common CRUD operations.
All entity-specific repositories inherit from this class.
"""

from datetime import datetime
from typing import TypeVar, Generic, Type, Optional, List, Any

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.base import Base


# Type variable for model classes
T = TypeVar("T", bound=Base)


class BaseRepository(Generic[T]):
    """
    Generic base repository for database operations.
    
    Type Parameters:
        T: SQLAlchemy model class.
    
    Usage:
        class UserRepository(BaseRepository[User]):
            def __init__(self, session: AsyncSession):
                super().__init__(User, session)
    """
    
    def __init__(self, model: Type[T], session: AsyncSession):
        """
        Initialize repository.
        
        Args:
            model: SQLAlchemy model class.
            session: Async database session.
        """
        self.model = model
        self.session = session
    
    async def get_by_id(self, id: int) -> Optional[T]:
        """
        Get entity by ID.
        
        Args:
            id: Primary key ID.
        
        Returns:
            Entity or None if not found.
        """
        stmt = select(self.model).where(self.model.id == id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_all(
        self,
        limit: int = 100,
        offset: int = 0,
        include_deleted: bool = False,
    ) -> List[T]:
        """
        Get all entities with pagination.
        
        Args:
            limit: Maximum number of entities.
            offset: Number of entities to skip.
            include_deleted: Include soft-deleted entities.
        
        Returns:
            List of entities.
        """
        stmt = select(self.model)
        
        if not include_deleted and hasattr(self.model, "deleted_at"):
            stmt = stmt.where(self.model.deleted_at.is_(None))
        
        stmt = stmt.limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
    
    async def create(self, data: dict[str, Any]) -> T:
        """
        Create new entity.
        
        Args:
            data: Entity data as dictionary.
        
        Returns:
            Created entity.
        """
        entity = self.model(**data)
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity
    
    async def update(self, id: int, data: dict[str, Any]) -> Optional[T]:
        """
        Update entity by ID.
        
        Args:
            id: Primary key ID.
            data: Fields to update.
        
        Returns:
            Updated entity or None if not found.
        """
        # Add updated_at if model has it
        if hasattr(self.model, "updated_at"):
            data["updated_at"] = func.current_timestamp()
        
        stmt = (
            update(self.model)
            .where(self.model.id == id)
            .values(**data)
            .returning(self.model)
        )
        result = await self.session.execute(stmt)
        entity = result.scalar_one_or_none()
        
        if entity:
            await self.session.refresh(entity)
        
        return entity
    
    async def soft_delete(self, id: int) -> bool:
        """
        Soft delete entity by setting deleted_at.
        
        Args:
            id: Primary key ID.
        
        Returns:
            True if entity was deleted, False if not found.
        """
        if not hasattr(self.model, "deleted_at"):
            raise ValueError(f"{self.model.__name__} does not support soft delete")
        
        stmt = (
            update(self.model)
            .where(self.model.id == id)
            .where(self.model.deleted_at.is_(None))
            .values(deleted_at=func.current_timestamp())
        )
        result = await self.session.execute(stmt)
        return result.rowcount > 0
    
    async def hard_delete(self, id: int) -> bool:
        """
        Permanently delete entity.
        
        Args:
            id: Primary key ID.
        
        Returns:
            True if entity was deleted, False if not found.
        """
        entity = await self.get_by_id(id)
        if entity:
            await self.session.delete(entity)
            return True
        return False
    
    async def count(self, include_deleted: bool = False) -> int:
        """
        Count total entities.
        
        Args:
            include_deleted: Include soft-deleted entities.
        
        Returns:
            Total count.
        """
        stmt = select(func.count()).select_from(self.model)
        
        if not include_deleted and hasattr(self.model, "deleted_at"):
            stmt = stmt.where(self.model.deleted_at.is_(None))
        
        result = await self.session.execute(stmt)
        return result.scalar() or 0
    
    async def exists(self, id: int) -> bool:
        """
        Check if entity exists.
        
        Args:
            id: Primary key ID.
        
        Returns:
            True if exists, False otherwise.
        """
        stmt = select(func.count()).select_from(self.model).where(self.model.id == id)
        result = await self.session.execute(stmt)
        return (result.scalar() or 0) > 0
