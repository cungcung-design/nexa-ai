"""Security defaults that do not need a database."""

import pytest
from fastapi import HTTPException

from app.core.environment import require_production_settings
from app.core.http_policy import resolve_cors_origins, resolve_trusted_hosts
from app.core.uploads import safe_upload_filename
from app.modules.security.rate_limit import (
    client_address,
    enforce_login_limits,
    enforce_rate_limit,
)


VALID_PRODUCTION = {
    "ENVIRONMENT": "production",
    "APP_ENV": "production",
    "DATABASE_URL": "postgresql+psycopg://nexa:example@postgres:5432/nexa_ai_staging",
    "REDIS_URL": "redis://redis:6379/0",
    "JWT_SECRET": "a" * 32,
    "SMTP_HOST": "smtp.example.com",
    "SMTP_FROM_EMAIL": "ops@example.com",
    "FRONTEND_URL": "https://app.example.com",
    "TRUSTED_HOSTS": "api.example.com",
}


def _production_env(monkeypatch, **overrides):
    values = dict(VALID_PRODUCTION)
    values.update(overrides)
    for name in (
        "ENVIRONMENT",
        "APP_ENV",
        "DATABASE_URL",
        "REDIS_URL",
        "JWT_SECRET",
        "SMTP_HOST",
        "SMTP_FROM_EMAIL",
        "FRONTEND_URL",
        "TRUSTED_HOSTS",
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "STRIPE_STARTER_PRICE_ID",
        "STRIPE_STARTER_YEARLY_PRICE_ID",
        "STRIPE_PRO_PRICE_ID",
        "STRIPE_PRO_YEARLY_PRICE_ID",
        "SMTP_USE_SSL",
        "SMTP_USE_STARTTLS",
    ):
        monkeypatch.delenv(name, raising=False)
    for name, value in values.items():
        monkeypatch.setenv(name, value)


def test_development_skips_production_checks(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.delenv("JWT_SECRET", raising=False)
    require_production_settings()


def test_production_accepts_explicit_settings(monkeypatch):
    _production_env(monkeypatch)
    require_production_settings()


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("JWT_SECRET", "short"),
        ("JWT_SECRET", "replace_with_at_least_32_characters"),
        ("APP_ENV", "development"),
        ("FRONTEND_URL", "*"),
        ("TRUSTED_HOSTS", "*"),
        ("STRIPE_SECRET_KEY", "sk_live_example"),
        ("STRIPE_SECRET_KEY", "not-a-stripe-key"),
        ("STRIPE_WEBHOOK_SECRET", "not-a-webhook-secret"),
        ("STRIPE_PRO_PRICE_ID", "price_REPLACE_pro"),
        ("STRIPE_PRO_PRICE_ID", "prod_123"),
        ("SMTP_USE_SSL", "true"),
    ],
)
def test_production_rejects_unsafe_values(monkeypatch, name, value):
    _production_env(monkeypatch, **{name: value})
    with pytest.raises(RuntimeError):
        require_production_settings()


def test_production_allows_a_stripe_test_key(monkeypatch):
    _production_env(monkeypatch, STRIPE_SECRET_KEY="sk_test_example")
    require_production_settings()


def test_cors_origins_are_explicit():
    assert resolve_cors_origins(
        "https://app.example.com, https://staging.example.com/"
    ) == ["https://app.example.com", "https://staging.example.com"]
    with pytest.raises(RuntimeError):
        resolve_cors_origins("*")


def test_trusted_hosts_keep_internal_names():
    assert resolve_trusted_hosts(
        "https://api.example.com:443",
        production=True,
    ) == ["api.example.com", "localhost", "127.0.0.1", "api"]
    with pytest.raises(RuntimeError):
        resolve_trusted_hosts("", production=True)


def test_upload_filename_drops_path_and_control_characters():
    assert safe_upload_filename("../../etc/passwd") == "passwd"
    assert safe_upload_filename("notes\r\n.txt") == "notes.txt"
    assert safe_upload_filename("..") == "document"
    assert safe_upload_filename("report.md") == "report.md"


class _FakeRedis:
    def __init__(self):
        self.counts = {}

    def eval(self, _script, _keys, key, _window):
        self.counts[key] = self.counts.get(key, 0) + 1
        return [self.counts[key], 30]


def test_login_limit_returns_429(monkeypatch):
    monkeypatch.setattr(
        "app.modules.security.rate_limit.redis_client",
        _FakeRedis(),
    )
    for _ in range(10):
        enforce_login_limits("person@example.com", "203.0.113.10")
    with pytest.raises(HTTPException) as caught:
        enforce_login_limits("person@example.com", "203.0.113.10")
    assert caught.value.status_code == 429


def test_forwarded_address_is_ignored_unless_the_proxy_is_trusted(monkeypatch):
    class _Client:
        host = "172.18.0.4"

    class _Request:
        client = _Client()
        headers = {"x-forwarded-for": "203.0.113.9"}

    monkeypatch.delenv("TRUST_PROXY", raising=False)
    assert client_address(_Request()) == "172.18.0.4"
    monkeypatch.setenv("TRUST_PROXY", "true")
    assert client_address(_Request()) == "203.0.113.9"


def test_rate_limit_fails_closed_when_redis_is_down(monkeypatch):
    class _Down:
        def eval(self, *_args):
            from redis.exceptions import RedisError

            raise RedisError("down")

    monkeypatch.setattr(
        "app.modules.security.rate_limit.redis_client",
        _Down(),
    )
    with pytest.raises(HTTPException) as caught:
        enforce_rate_limit("login-email:person@example.com", limit=1, window_seconds=60)
    assert caught.value.status_code == 503
