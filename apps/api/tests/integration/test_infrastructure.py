import os

import pytest
import redis
from sqlalchemy import create_engine, text


@pytest.mark.integration
def test_postgresql_connection():
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("TEST_DATABASE_URL not configured")
    engine = create_engine(database_url)
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1")).scalar_one()
        assert result == 1
    finally:
        engine.dispose()


@pytest.mark.integration
def test_redis_connection():
    redis_url = os.environ.get("TEST_REDIS_URL", "").strip()
    if not redis_url:
        pytest.skip(
            "TEST_REDIS_URL is not configured. "
            "Point it at NEXORA Redis, not a shared localhost:6379."
        )

    client = redis.Redis.from_url(
        redis_url,
        socket_connect_timeout=5,
        socket_timeout=5,
        decode_responses=True,
    )
    key = "nexa:integration:test"
    try:
        assert client.ping() is True
        client.set(key, "connected", ex=30)
        assert client.get(key) == "connected"
    except redis.RedisError as exc:
        pytest.skip(f"NEXORA Redis is not available: {exc}")
    finally:
        try:
            client.delete(key)
        except redis.RedisError:
            pass
        client.close()
