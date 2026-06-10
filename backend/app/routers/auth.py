import logging
import re

from fastapi import APIRouter, Depends, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import create_token, get_current_user
from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import AuthResponse, GoogleAuthRequest, UserOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _verify_google_credential(credential: str) -> dict:
    if not settings.google_client_id:
        raise HTTPException(
            503, "Google sign-in is not configured — set GOOGLE_CLIENT_ID"
        )
    try:
        return id_token.verify_oauth2_token(
            credential, google_requests.Request(), settings.google_client_id
        )
    except ValueError:
        raise HTTPException(401, "Invalid Google credential")


def _unique_username(db: Session, info: dict) -> str:
    base = (info.get("email") or "player").split("@")[0].lower()
    base = re.sub(r"[^a-z0-9_.-]", "", base)[:40] or "player"
    username = base
    suffix = 1
    while db.scalars(select(User).where(User.username == username)).first():
        suffix += 1
        username = f"{base}{suffix}"
    return username


@router.post("/google", response_model=AuthResponse)
def google_sign_in(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    info = _verify_google_credential(payload.credential)
    user = db.scalars(select(User).where(User.google_sub == info["sub"])).first()
    if user is None:
        user = User(
            google_sub=info["sub"],
            username=_unique_username(db, info),
            display_name=info.get("name") or info.get("email", "Player").split("@")[0],
            email=info.get("email"),
            picture=info.get("picture"),
        )
        db.add(user)
        logger.info("New user via Google sign-in: %s", user.username)
    else:
        # keep profile fresh on every sign-in
        user.display_name = info.get("name") or user.display_name
        user.email = info.get("email") or user.email
        user.picture = info.get("picture") or user.picture
    db.commit()
    db.refresh(user)
    return AuthResponse(token=create_token(user.id), user=user)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
