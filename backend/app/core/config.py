from functools import lru_cache
from uuid import UUID

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    openai_api_key: str
    openai_embedding_model: str = "text-embedding-3-small"
    embedding_dimension: int = 1536
    default_workspace_id: UUID = UUID("00000000-0000-0000-0000-000000000001")
    default_owner_id: UUID = UUID("00000000-0000-0000-0000-000000000001")
    default_project_id: UUID = UUID("00000000-0000-0000-0000-000000000001")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
