"""
database.py — SQLAlchemy session factory and Base class.

Uses SQLite by default (DATABASE_URL=sqlite:///./agrosmart.db).
Swap DATABASE_URL for a PostgreSQL connection string in production.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./agrosmart.db")

# SQLite needs check_same_thread=False because FastAPI runs in a thread pool.
# For other databases this kwarg is ignored.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that yields a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
