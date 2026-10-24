"""Check a staging env file without printing secret values.

local mode reports SMTP, Stripe, and local-only inference as blocked.
vps mode fails those same conditions because a public host cannot use them.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


REQUIRED = (
    "ENVIRONMENT",
    "APP_ENV",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",
    "REDIS_URL",
    "JWT_SECRET",
    "FRONTEND_URL",
    "NEXA_API_URL",
    "NEXT_PUBLIC_API_URL",
    "LLM_BASE_URL",
    "LLM_API_KEY",
    "SMTP_HOST",
    "SMTP_FROM_EMAIL",
    "APP_DOMAIN",
    "API_DOMAIN",
    "LETSENCRYPT_EMAIL",
)


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[2] not in {"local", "vps"}:
        print("usage: check_vps_env.py <env-file> <local|vps>", file=sys.stderr)
        return 2
    mode = sys.argv[2]
    path = Path(sys.argv[1])
    env = load_env(path)
    failures: list[str] = []
    blocked: list[str] = []

    missing = [key for key in REQUIRED if not env.get(key)]
    if missing:
        failures.append("missing " + ",".join(missing))

    if env.get("ENVIRONMENT") != "production" or env.get("APP_ENV") != "production":
        failures.append("ENVIRONMENT and APP_ENV must both be production")

    jwt = env.get("JWT_SECRET", "")
    if len(jwt) < 32 or jwt.lower() in {
        "changeme",
        "secret",
        "password",
        "replace_with_long_random_secret",
        "replace_with_at_least_32_characters",
    } or "replace_with" in jwt.lower():
        failures.append("JWT_SECRET must be a unique value of at least 32 characters")
    frontend = env.get("FRONTEND_URL", "")
    if "*" in {part.strip() for part in frontend.split(",")}:
        failures.append("FRONTEND_URL cannot use a wildcard CORS origin")
    trusted = env.get("TRUSTED_HOSTS", "")
    if "*" in {part.strip() for part in trusted.split(",")}:
        failures.append("TRUSTED_HOSTS cannot contain a wildcard")
    dev_env = Path("apps/api/.env")
    if dev_env.exists():
        dev_jwt = load_env(dev_env).get("JWT_SECRET", "")
        if dev_jwt and jwt == dev_jwt:
            failures.append("JWT_SECRET matches the development env file")
        elif dev_jwt:
            print("jwt-distinct-from-development")

    password = env.get("POSTGRES_PASSWORD", "")
    if password and not password.isalnum():
        failures.append("POSTGRES_PASSWORD must be letters and digits")
    database_url = env.get("DATABASE_URL", "")
    if database_url:
        if mode == "vps" and "@postgres:5432/" not in database_url:
            failures.append("DATABASE_URL must use the postgres hostname")
    else:
        print("database-url-composed-by-compose")

    if mode == "vps":
        if env.get("REDIS_URL") != "redis://redis:6379/0":
            failures.append("REDIS_URL must be the internal redis address")
        if env.get("NEXA_API_URL") != "http://api:8000":
            failures.append("NEXA_API_URL must be http://api:8000")
        if not env.get("FRONTEND_URL", "").startswith("https://"):
            failures.append("FRONTEND_URL must be https")
        if not env.get("NEXT_PUBLIC_API_URL", "").startswith("https://"):
            failures.append("NEXT_PUBLIC_API_URL must be https")
        for name in ("APP_DOMAIN", "API_DOMAIN"):
            value = env.get(name, "")
            if "://" in value or "/" in value or ":" in value:
                failures.append(f"{name} must be a bare hostname")
        if env.get("API_DOMAIN") and env.get("NEXT_PUBLIC_API_URL") != f"https://{env.get('API_DOMAIN')}":
            failures.append("NEXT_PUBLIC_API_URL must be https://API_DOMAIN")
        if env.get("APP_DOMAIN") and env.get("FRONTEND_URL") != f"https://{env.get('APP_DOMAIN')}":
            failures.append("FRONTEND_URL must be https://APP_DOMAIN")
        if env.get("COOKIE_SECURE", "true").lower() == "false":
            failures.append("COOKIE_SECURE must be true behind HTTPS")
        elif "COOKIE_SECURE" not in env:
            print("cookie-secure-set-by-compose")
        if env.get("TRUST_PROXY", "true").lower() == "false":
            failures.append("TRUST_PROXY must stay enabled for the private Caddy hop")
        elif "TRUST_PROXY" not in env:
            print("trust-proxy-set-by-compose")
        if trusted:
            hosts = {part.strip().split(":")[0] for part in trusted.split(",") if part.strip()}
            if env.get("API_DOMAIN") and env["API_DOMAIN"] not in hosts:
                failures.append("TRUSTED_HOSTS must include API_DOMAIN")
        else:
            print("trusted-hosts-composed-from-api-domain")

    smtp_host = env.get("SMTP_HOST", "")
    smtp_from = env.get("SMTP_FROM_EMAIL", "")
    smtp_blocked = (
        not smtp_host
        or smtp_host.endswith(".invalid")
        or smtp_from.endswith(".invalid")
        or "example.invalid" in smtp_from
    )
    if smtp_blocked:
        blocked.append("smtp")
        if mode == "vps":
            failures.append("SMTP placeholder is not a working mail server")

    def _enabled(name: str, default: str) -> bool:
        return env.get(name, default).strip().lower() in {"1", "true", "yes", "on"}

    if _enabled("SMTP_USE_SSL", "false") and _enabled("SMTP_USE_STARTTLS", "true"):
        failures.append("SMTP_USE_SSL and SMTP_USE_STARTTLS cannot both be enabled")

    stripe = env.get("STRIPE_SECRET_KEY", "")
    webhook_secret = env.get("STRIPE_WEBHOOK_SECRET", "").strip()
    if stripe.startswith("sk_live_"):
        failures.append("live Stripe secret is not allowed for staging")
    elif stripe.startswith("sk_test_"):
        print("stripe-test-mode")
        if webhook_secret.startswith("whsec_"):
            print("stripe-webhook-secret")
        elif mode == "vps":
            failures.append("STRIPE_WEBHOOK_SECRET must be a whsec_ signing secret")
    else:
        blocked.append("stripe")
        if mode == "vps":
            failures.append("Stripe test keys are not configured")
    if webhook_secret and not webhook_secret.startswith("whsec_"):
        failures.append("STRIPE_WEBHOOK_SECRET must start with whsec_")

    price_names = (
        "STRIPE_STARTER_PRICE_ID",
        "STRIPE_STARTER_YEARLY_PRICE_ID",
        "STRIPE_PRO_PRICE_ID",
        "STRIPE_PRO_YEARLY_PRICE_ID",
    )
    for price_name in price_names:
        price_id = env.get(price_name, "").strip()
        if price_id and (
            "REPLACE" in price_id.upper()
            or re.fullmatch(r"price_[A-Za-z0-9_]+", price_id) is None
        ):
            failures.append(f"{price_name} is not a Stripe price id")
    if stripe.startswith("sk_test_") and mode == "vps":
        missing_prices = [name for name in price_names if not env.get(name, "").strip()]
        if missing_prices:
            failures.append("Stripe test price ids are not configured")

    llm = env.get("LLM_BASE_URL", "")
    local_llm = any(token in llm for token in ("host.docker.internal", "localhost", "127.0.0.1"))
    if local_llm or not llm.startswith("https://"):
        blocked.append("llm")
        if mode == "vps":
            failures.append("LLM_BASE_URL is not an HTTPS endpoint reachable from the VPS")

    if blocked and mode == "local":
        print("blocked " + ",".join(blocked))
    if failures:
        print("fail " + "; ".join(failures))
        return 1
    print(f"env-check-ok mode={mode}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
