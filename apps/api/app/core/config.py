from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Nexa AI API"
    app_env: str = "development"
    database_url: str
    frontend_url: str = "http://localhost:3000"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_minutes: int = 15

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