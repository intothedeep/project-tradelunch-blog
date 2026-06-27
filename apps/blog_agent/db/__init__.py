# db/__init__.py
"""
SQLAlchemy Database Module

Provides async database operations for PostgreSQL using SQLAlchemy 2.x.

Usage:
    from db import get_db_session, CategoryRepository, PostRepository

    async with get_db_session() as session:
        repo = CategoryRepository(session)
        await repo.insert_category_hierarchy(['tech', 'ai'], user_id=1)
        await session.commit()
"""

from db.connection import DatabaseSession, get_db_session, get_engine
from db.models import (
    Category,
    File,
    Post,
    PostCategory,
    PostTag,
    Tag,
    User,
)
from db.repositories.category import CategoryRepository
from db.repositories.file import FileRepository
from db.repositories.post import PostRepository
from db.repositories.tag import TagRepository
from db.storage import (
    FileMetadata,
    async_get_signed_url,
    async_load_local_file,
    async_upload_file,
    delete_file,
    file_exists,
    get_signed_url,
    load_local_file,
    upload_file,
)
from utils.snowflake import Snowflake

__all__ = [
    # Connection
    "get_db_session",
    "get_engine",
    "DatabaseSession",
    # Models
    "User",
    "Post",
    "Category",
    "File",
    "Tag",
    "PostTag",
    "PostCategory",
    # Repositories
    "CategoryRepository",
    "PostRepository",
    "FileRepository",
    "TagRepository",
    # Utils
    "Snowflake",
    # Storage
    "FileMetadata",
    "load_local_file",
    "upload_file",
    "get_signed_url",
    "delete_file",
    "file_exists",
    "async_upload_file",
    "async_load_local_file",
    "async_get_signed_url",
]
