"""
routers/profile.py — Authenticated user profile endpoint.

GET /profile
  → Returns the current user's profile (requires valid Clerk JWT).
  → Creates the user record on first call (upsert via get_or_create_user).

Response shape:
    {
        "id":         "user_2abc...",
        "email":      "user@example.com",
        "first_name": "Jane",
        "last_name":  "Doe",
        "image_url":  "https://img.clerk.com/...",
        "created_at": "2025-01-01T00:00:00+00:00",
        "updated_at": "2025-01-01T00:00:00+00:00"
    }
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import get_current_user
from db_models import User

router = APIRouter(tags=["profile"])


class UserProfileResponse(BaseModel):
    id: str
    email: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    image_url: Optional[str]
    created_at: datetime
    updated_at: datetime


@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(current_user: User = Depends(get_current_user)) -> UserProfileResponse:
    """Return the authenticated user's profile."""
    return UserProfileResponse(
        id=current_user.clerk_id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        image_url=current_user.avatar_url,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
    )
