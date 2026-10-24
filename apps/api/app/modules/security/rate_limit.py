import hashlib
import os

import redis
from fastapi import HTTPException, Request, status


REDIS_URL = os.getenv(
    "REDIS_URL",
    "redis://localhost:6379/0",
)

redis_client = redis.Redis.from_url(
    REDIS_URL,
    decode_responses=True,
    socket_connect_timeout=2,
    socket_timeout=2,
)

RATE_LIMIT_SCRIPT = """
local current = redis.call("INCR", KEYS[1])

if current == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
end

local ttl = redis.call("TTL", KEYS[1])

return {current, ttl}
"""


def trust_proxy() -> bool:
    return os.getenv("TRUST_PROXY", "").strip().lower() in {"1", "true", "yes"}


def client_address(request: Request) -> str:
    """Return the caller address used for a rate-limit bucket.

    Forwarded headers are read only when the process is behind the private
    proxy. A published API port must leave TRUST_PROXY unset.
    """
    if trust_proxy():
        forwarded = request.headers.get("x-forwarded-for", "")
        first = forwarded.split(",", 1)[0].strip()
        if first:
            return first
    if request.client is not None and request.client.host:
        return request.client.host
    return "unknown"


def enforce_login_limits(email: str, host: str) -> None:
    enforce_rate_limit(
        identity=f"login-email:{email.lower()}",
        limit=10,
        window_seconds=15 * 60,
    )
    enforce_rate_limit(
        identity=f"login-ip:{host}",
        limit=60,
        window_seconds=15 * 60,
    )


def enforce_password_reset_limit(host: str) -> None:
    enforce_rate_limit(
        identity=f"password-reset-ip:{host}",
        limit=30,
        window_seconds=60 * 60,
    )


def enforce_ai_limit(identity: str) -> None:
    enforce_rate_limit(
        identity=f"ai:{identity}",
        limit=20,
        window_seconds=60,
    )


def enforce_rate_limit(
    identity: str,
    limit: int = 60,
    window_seconds: int = 60,
):
    if limit < 1 or window_seconds < 1:
        raise ValueError("Invalid rate limit configuration")

    digest = hashlib.sha256(
        identity.encode("utf-8")
    ).hexdigest()

    key = f"nexa:rate-limit:{digest}"

    try:
        count, ttl = redis_client.eval(
            RATE_LIMIT_SCRIPT,
            1,
            key,
            window_seconds,
        )

    except redis.RedisError:
        # Fail closed for protected public endpoints.
        raise HTTPException(
            status_code=503,
            detail="Rate limiting temporarily unavailable",
        )

    if int(count) > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
        )