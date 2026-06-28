"""
crud.py — Database operations for User management.

get_or_create_user is called on every authenticated request.
On first visit it fetches the Clerk profile via the Management API and
persists it locally so subsequent calls are a cheap DB lookup.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from db_models import User

logger = logging.getLogger("agrosmart.crud")

CLERK_API_BASE = "https://api.clerk.com/v1"
CLERK_SECRET_KEY: Optional[str] = os.getenv("CLERK_SECRET_KEY")


async def _fetch_clerk_user(clerk_id: str) -> dict:
    """
    Fetch user details from the Clerk Management API.
    Returns a dict with email_addresses, first_name, last_name, image_url.
    Falls back to an empty dict if the call fails (non-blocking).
    """
    if not CLERK_SECRET_KEY:
        logger.warning("CLERK_SECRET_KEY not set — skipping Clerk user fetch")
        return {}

    url = f"{CLERK_API_BASE}/users/{clerk_id}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"},
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.warning("Failed to fetch Clerk user %s: %s", clerk_id, exc)
        return {}


async def get_or_create_user(db: Session, clerk_id: str) -> User:
    """
    Return the local User record for clerk_id, creating it if needed.

    On first call for a given clerk_id the Clerk Management API is queried
    for the profile details (email, name, avatar).  After that every call is
    just a primary-key lookup on the local DB.
    """
    user: Optional[User] = db.get(User, clerk_id)
    if user:
        return user

    # New user — pull their profile from Clerk
    clerk_data = await _fetch_clerk_user(clerk_id)

    email_addresses = clerk_data.get("email_addresses", [])
    primary_email = next(
        (e["email_address"] for e in email_addresses if e.get("id") == clerk_data.get("primary_email_address_id")),
        email_addresses[0]["email_address"] if email_addresses else None,
    )

    user = User(
        clerk_id=clerk_id,
        email=primary_email,
        first_name=clerk_data.get("first_name"),
        last_name=clerk_data.get("last_name"),
        avatar_url=clerk_data.get("image_url"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    logger.info("Created local user record for clerk_id=%s email=%s", clerk_id, user.email)
    return user
