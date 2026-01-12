"""Configuration management for AI Incident Investigator."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # OpenAI Configuration
    openai_api_key: str = ""
    openai_api_base: str = "https://api.openai.com/v1"
    
    # Model Configuration
    embedding_model: str = "text-embedding-3-small"
    chat_model: str = "gpt-4o-mini"
    
    # Analysis Configuration
    default_top_k: int = 8
    default_hypothesis_count: int = 3
    confidence_threshold: float = 0.6
    
    # Storage paths
    cases_directory: str = "./cases"
    chroma_persist_directory: str = "./chroma_db"
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8003
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
