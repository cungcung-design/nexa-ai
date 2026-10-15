import hashlib
import os

import redis
from fastapi import HTTPException, status


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