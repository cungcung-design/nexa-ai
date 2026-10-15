import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from urllib.parse import urlparse


def validate_test_database_url(url: str) -> None:
    parsed = urlparse(url)
    database_name = parsed.path.lstrip("/")
    if not database_name.endswith("_test"):
        raise RuntimeError(
            "Refusing to run integration tests against "
            "a database without the '_test' suffix"
        )


@pytest.fixture
def db_session():
    database_url = os.getenv("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("TEST_DATABASE_URL is not configured")
    if not database_url.startswith(
        ("postgresql://", "postgresql+psycopg://")
    ):
        raise RuntimeError(
            "A PostgreSQL test database is required"
        )

    validate_test_database_url(database_url)

    engine = create_engine(
        database_url,
        pool_pre_ping=True,
    )
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection,
        join_transaction_mode="create_savepoint",
    )

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()
        engine.dispose()


@pytest.fixture
def client(db_session):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.db.session import get_db

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
