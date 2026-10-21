from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "NEXORA API"
    app_env: str = "development"
    database_url: str
    frontend_url: str = "http://localhost:3000"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_minutes: int = 15

    #: Lifetime of a password reset link and the guards around the request
    #: endpoint. The cooldown keeps a single account from flooding the mail
    #: server, the window limit caps the number of links per hour.
    password_reset_token_minutes: int = 30
    password_reset_cooldown_seconds: int = 60
    password_reset_max_requests: int = 5
    password_reset_request_window_minutes: int = 60
    #: Without a mail server the reset link is returned in the response so the
    #: flow stays testable. The flag is ignored outside of development.
    password_reset_dev_expose_link: bool = True

    #: Outgoing mail server. Without a host the mailer falls back to the
    #: development sink, which never writes a token to a log.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "NEXORA"
    smtp_use_starttls: bool = True
    smtp_timeout_seconds: int = 10

    #: Inbox that receives the messages of the contact form. The message is
    #: stored in the database as well, so a missing mail server never loses a
    #: request.
    contact_inbox_email: str = "hello@nexora.ai"

    llm_base_url: str = "http://localhost:11434/v1"
    llm_api_key: str = "ollama"
    llm_default_model: str = "qwen3:4b"
    llm_timeout_seconds: int = 60
    #: Comma separated list of models the backend can serve. The settings
    #: screens only offer these models plus the ones already used inside the
    #: workspace.
    llm_available_models: str = (
        "qwen3:4b,gpt-4.1-mini,gpt-4.1,gpt-4o,gpt-4o-mini"
    )

    redis_url: str = "redis://localhost:6379/0"
    document_storage_path: str = "./storage/documents"
    audit_export_storage_path: str = "./storage/audit-exports"
    audit_display_timezone: str = "UTC"

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_pro_price_id: str = ""
    stripe_business_price_id: str = ""
    stripe_starter_price_id: str = ""
    stripe_starter_yearly_price_id: str = ""
    stripe_pro_yearly_price_id: str = ""
    #: Price charged per thousand metered tokens, in cents. Zero means the
    #: tokens are included in the plan.
    billing_price_per_1k_tokens: int = 0

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()