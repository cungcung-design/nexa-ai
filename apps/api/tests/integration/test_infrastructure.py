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
    redis_url = os.environ.get("TEST_REDIS_URL", "redis://localhost:6379/0")
    try:
        client = redis.Redis.from_url(
            redis_url,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
        assert client.ping() is True

        client.set("nexa:integration:test", "connected", ex=30)
        value = client.get("nexa:integration:test")
        assert value == "connected"
        client.delete("nexa:integration:test")
    except redis.RedisError:
        pytest.skip("Redis is not available")
