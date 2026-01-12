"""Configuration management for RAG Knowledge Assistant."""

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
    
    # RAG Configuration
    chunk_size: int = 500
    chunk_overlap: int = 50
    top_k: int = 5
    confidence_threshold: float = 0.7
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8001
    
    # Storage paths
    chroma_persist_directory: str = "./chroma_db"
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
