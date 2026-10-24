import os
import re

from app.core.http_policy import resolve_cors_origins, resolve_trusted_hosts


_PLACEHOLDER_SECRETS = {
    "changeme",
    "secret",
    "password",
    "replace_with_long_random_secret",
    "replace_with_at_least_32_characters",
}


def is_production() -> bool:
    return (
        os.getenv("ENVIRONMENT", "development")
        .lower() == "production"
    )


def require_production_settings() -> None:
    if not is_production():
        return

    required = [
        "DATABASE_URL",
        "REDIS_URL",
        "JWT_SECRET",
        "SMTP_HOST",
        "SMTP_FROM_EMAIL",
        "FRONTEND_URL",
        "APP_ENV",
        "TRUSTED_HOSTS",
    ]
    missing = [
        name
        for name in required
        if not os.getenv(name)
    ]
    if missing:
        raise RuntimeError(
            "Missing production settings: "
            + ", ".join(missing)
        )

    if os.environ["APP_ENV"].lower() != "production":
        raise RuntimeError(
            "APP_ENV must be production when ENVIRONMENT is production"
        )

    jwt_secret = os.environ["JWT_SECRET"]
    if len(jwt_secret) < 32 or jwt_secret.lower() in _PLACEHOLDER_SECRETS:
        raise RuntimeError(
            "JWT_SECRET must be a unique value of at least 32 characters"
        )
    if "replace_with" in jwt_secret.lower():
        raise RuntimeError("JWT_SECRET is still a placeholder")

    resolve_cors_origins(os.environ["FRONTEND_URL"])
    resolve_trusted_hosts(os.environ["TRUSTED_HOSTS"], production=True)

    stripe_secret = os.getenv("STRIPE_SECRET_KEY", "")
    if stripe_secret.startswith("sk_live_") or (
        stripe_secret and not stripe_secret.startswith("sk_test_")
    ):
        raise RuntimeError(
            "STRIPE_SECRET_KEY must be empty or a Stripe test key"
        )

    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    if webhook_secret and not webhook_secret.startswith("whsec_"):
        raise RuntimeError("STRIPE_WEBHOOK_SECRET must start with whsec_")

    for price_name in (
        "STRIPE_STARTER_PRICE_ID",
        "STRIPE_STARTER_YEARLY_PRICE_ID",
        "STRIPE_PRO_PRICE_ID",
        "STRIPE_PRO_YEARLY_PRICE_ID",
    ):
        price_id = os.getenv(price_name, "")
        if price_id and (
            "REPLACE" in price_id.upper()
            or re.fullmatch(r"price_[A-Za-z0-9_]+", price_id) is None
        ):
            raise RuntimeError(f"{price_name} is not a Stripe price id")

    use_ssl = os.getenv("SMTP_USE_SSL", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    use_starttls = os.getenv("SMTP_USE_STARTTLS", "true").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    if use_ssl and use_starttls:
        raise RuntimeError(
            "SMTP_USE_SSL and SMTP_USE_STARTTLS cannot both be enabled"
        )
