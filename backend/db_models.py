"""
db_models.py — SQLAlchemy ORM models.

Intentionally named db_models to avoid collision with backend/models/
which holds the Keras U-Net model file.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime
from database import Base


class User(Base):
    """
    Represents a Clerk-authenticated user synced to the local database.

    clerk_id is the Clerk user ID (sub claim in the JWT, e.g. "user_2abc...").
    It is the primary key so we never create duplicate users.
    """

    __tablename__ = "users"

    clerk_id   = Column(String, primary_key=True, index=True)
    email      = Column(String, unique=True, index=True, nullable=True)
    first_name = Column(String, nullable=True)
    last_name  = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
