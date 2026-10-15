from functools import lru_cache
from openai import OpenAI
from app.core.config import settings


@lru_cache(maxsize=1)
def get_llm_client() -> OpenAI:
    return OpenAI(
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key,
        timeout=settings.llm_timeout_seconds,
        max_retries=1,
    )
