# db/base.py
"""
SQLAlchemy Base Model and Mixins

Provides the declarative base and common column mixins used by all models.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


class TimestampMixin:
    """Mixin for created_at/updated_at timestamps."""
    
    created_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        default=func.current_timestamp(),
        nullable=True,
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=True,
    )


class SoftDeleteMixin:
    """Mixin for soft delete support."""
    
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        default=None,
        nullable=True,
    )


class SequenceMixin:
    """Mixin for auto-incrementing seq column (for ordering)."""
    
    seq: Mapped[int] = mapped_column(
        BigInteger,
        autoincrement=True,
        unique=True,
        nullable=False,
    )
