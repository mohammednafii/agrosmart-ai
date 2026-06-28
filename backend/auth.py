"""
auth.py — Clerk JWT verification and FastAPI auth dependency.

Verification flow:
  1. Extract Bearer token from Authorization header.
  2. Fetch Clerk's public JWKS (cached by PyJWKClient — no per-request HTTP call).
  3. Verify RS256 signature + expiry.
  4. Extract sub (Clerk user ID) from the payload.
  5. get_or_create_user() → returns the local DB User record.

Every protected endpoint receives the current User via:
    current_user: User = Depends(get_current_user)
"""

import logging
import os
from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import get_db
from db_models import User
from crud import get_or_create_user

logger = logging.getLogger("agrosmart.auth")

# ── Clerk JWKS configuration ───────────────────────────────────────────────────

CLERK_FRONTEND_API_URL: Optional[str] = os.getenv("CLERK_FRONTEND_API_URL")

if not CLERK_FRONTEND_API_URL:
    logger.warning(
        "CLERK_FRONTEND_API_URL is not set. "
        "JWT verification will fail. Set it in backend/.env"
    )
    _JWKS_URL = ""
else:
    _JWKS_URL = f"{CLERK_FRONTEND_API_URL.rstrip('/')}/.well-known/jwks.json"

# PyJWKClient fetches JWKS once and caches it; thread-safe singleton.
_jwks_client: Optional[PyJWKClient] = PyJWKClient(_JWKS_URL) if _JWKS_URL else None

# ── HTTP Bearer scheme ─────────────────────────────────────────────────────────
_bearer = HTTPBearer()


def verify_clerk_token(token: str) -> dict:
    """
    Verify a Clerk-issued JWT and return its decoded payload.

    Raises HTTPException(401) if the token is missing, expired, or tampered with.
    """
    if _jwks_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth not configured: CLERK_FRONTEND_API_URL missing in backend/.env",
        )
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={
                "verify_aud": False,  # Clerk does not set a standard aud claim
            },
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {exc}")
    except Exception as exc:
        logger.exception("Unexpected JWT verification error")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency — verifies the JWT and returns the authenticated User.

    Usage:
        @app.get("/some-protected-route")
        async def handler(current_user: User = Depends(get_current_user)):
            ...
    """
    payload = verify_clerk_token(credentials.credentials)

    clerk_id: Optional[str] = payload.get("sub")
    if not clerk_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing sub claim",
        )

    # Sync user to local DB (no-op if they already exist)
    user = await get_or_create_user(db, clerk_id)
    return user
