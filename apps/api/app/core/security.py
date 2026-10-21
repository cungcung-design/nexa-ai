from datetime import datetime, timedelta, timezone
from uuid import UUID
import jwt
from pwdlib import PasswordHash
from app.core.config import settings

password_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_hasher.verify(password, password_hash)


def create_access_token(user_id: UUID, token_version: int = 0) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.jwt_access_token_minutes)
    payload = {
        "sub": str(user_id),
        # The session version of the account. It changes whenever the
        # password changes, which invalidates every token that was issued
        # before that moment.
        "ver": token_version,
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(
        payload, settings.jwt_secret, algorithm=settings.jwt_algorithm
    )


def decode_token(token: str) -> dict:
    return jwt.decode(
        token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )