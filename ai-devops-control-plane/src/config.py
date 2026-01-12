"""Configuration management for AI DevOps Control Plane."""

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
    default_top_k: int = 10
    confidence_threshold: float = 0.6
    
    # Storage paths
    changes_directory: str = "./changes"
    chroma_persist_directory: str = "./chroma_db"
    
    # Integration - Incident Investigator
    incident_service_url: str = "http://localhost:8003"
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8004
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
