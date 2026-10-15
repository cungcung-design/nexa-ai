import os


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

    jwt_secret = os.environ["JWT_SECRET"]
    if len(jwt_secret) < 32:
        raise RuntimeError(
            "JWT_SECRET must be at least 32 characters in production"
        )
