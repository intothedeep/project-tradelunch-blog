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

from db.connection import get_db_session, get_engine, DatabaseSession
from db.models import (
    User,
    Post,
    Category,
    File,
    Tag,
    PostTag,
    PostCategory,
)
from db.repositories.category import CategoryRepository
from db.repositories.post import PostRepository
from db.repositories.file import FileRepository
from db.repositories.tag import TagRepository
from utils.snowflake import Snowflake
from db.s3 import (
    FileMetadata,
    load_local_file,
    upload_file_s3,
    get_signed_url,
    delete_file_s3,
    file_exists_s3,
    async_upload_file_s3,
    async_load_local_file,
    async_get_signed_url,
)

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
    # S3
    "FileMetadata",
    "load_local_file",
    "upload_file_s3",
    "get_signed_url",
    "delete_file_s3",
    "file_exists_s3",
    "async_upload_file_s3",
    "async_load_local_file",
    "async_get_signed_url",
]

