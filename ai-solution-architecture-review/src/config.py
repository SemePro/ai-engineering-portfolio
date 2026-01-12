"""Configuration management for AI Solution Architecture Review."""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # OpenAI Configuration
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    chat_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"
    
    # Storage paths
    reviews_directory: str = "./reviews"
    chroma_db_path: str = "./chroma_db"
    
    # Analysis settings
    default_top_k: int = 5
    default_temperature: float = 0.3
    confidence_threshold: float = 0.6
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8005
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Backward compatibility exports (used by other modules)
# These will be deprecated in future versions
_settings = get_settings()
OPENAI_API_KEY = _settings.openai_api_key
OPENAI_BASE_URL = _settings.openai_base_url
CHAT_MODEL = _settings.chat_model
EMBEDDING_MODEL = _settings.embedding_model
REVIEWS_DIR = _settings.reviews_directory
CHROMA_DIR = _settings.chroma_db_path
DEFAULT_TOP_K = _settings.default_top_k
DEFAULT_TEMPERATURE = _settings.default_temperature
CONFIDENCE_THRESHOLD = _settings.confidence_threshold
