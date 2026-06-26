# SQLAlchemy Database Module

## Summary

SQLAlchemy 2.x database module for async PostgreSQL operations. This module provides the data access layer for the blog multi-agent system.

## Files

```
db/
├── __init__.py           # Module exports
├── base.py               # Base model, declarative base, mixins
├── connection.py         # Async session factory (asyncpg)
├── models.py             # ORM models for all tables
├── s3.py                 # S3 upload/download utilities
└── repositories/
    ├── __init__.py
    ├── base.py           # Generic CRUD operations
    ├── category.py       # Hierarchical category insertion
    ├── post.py           # Post creation with Snowflake IDs
    ├── file.py           # File metadata (S3 references)
    └── tag.py            # Tag UPSERT and linking
```

## Usage Examples

### 1. Insert Category Hierarchy

```python
from db import get_db_session, CategoryRepository

async def create_categories():
    async with get_db_session() as session:
        repo = CategoryRepository(session)

        # Insert: technology → ai → machine-learning
        leaf_id = await repo.insert_category_hierarchy(
            categories=['technology', 'ai', 'machine-learning'],
            user_id=2
        )
        await session.commit()

        print(f"Leaf category ID: {leaf_id}")
```

### 2. Create Post

```python
from db import get_db_session, PostRepository

async def create_post():
    async with get_db_session() as session:
        repo = PostRepository(session)

        post_id = await repo.create_post(
            user_id=2,
            title="My Article",
            slug="my-article",
            content="# Hello World\n\nThis is content...",
            category_id=123,
        )
        await session.commit()

        print(f"Created post ID: {post_id}")
```

### 3. Record File Metadata

```python
from db import get_db_session, FileRepository

async def record_file():
    async with get_db_session() as session:
        repo = FileRepository(session)

        file_id = await repo.create_file_record(
            user_id=2,
            post_id=123,
            original_filename="image.png",
            stored_name="my-article.png",
            s3_key="2/tech/ai/my-article/my-article.png",
            stored_uri="https://cdn.example.com/...",
            content_type="image/png",
            is_thumbnail=True,
        )
        await session.commit()
```

---

## Configuration

The module uses settings from `configs/database.py` (re-exported via `config.py`):

```python
from configs.database import DB_PG_HOST, DB_PG_PORT, DB_PG_NAME, DB_PG_USER, DB_PG_PASSWORD

# Or via config.py entry point
from config import DB_PG_HOST, DB_PG_PORT, DB_PG_NAME
```

Settings are loaded from environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PG_HOST` | Database host | `localhost` |
| `DB_PG_PORT` | Database port | `5432` |
| `DB_PG_NAME` | Database name | `tradelunch` |
| `DB_PG_USER` | Database user | `super` |
| `DB_PG_PASSWORD` | Database password | *(required)* |

Ensure your `.env` file has the database credentials configured.

---

## Models

The following SQLAlchemy models are available in `models.py`:

- **User** - User accounts
- **Post** - Blog posts/comments (hierarchical)
- **Category** - Post categories (hierarchical)
- **File** - Uploaded files (S3 references)
- **Tag** - Content tags
- **PostTag** - Post-tag relationships
- **PostCategory** - Post-category relationships

## Repositories

| Repository | Purpose |
|------------|---------|
| `CategoryRepository` | Hierarchical category insertion |
| `PostRepository` | Post creation with Snowflake IDs |
| `FileRepository` | File metadata management |
| `TagRepository` | Tag UPSERT and post-tag linking |

## See Also

- [schema/tradelunch.schema.sql](../schema/tradelunch.schema.sql) - SQL DDL
- [configs/database.py](../configs/database.py) - Database configuration
- [utils/snowflake.py](../utils/snowflake.py) - Snowflake ID generator
