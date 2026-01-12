"""Configuration management for LLM Eval Harness."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # OpenAI Configuration
    openai_api_key: str = ""
    openai_api_base: str = "https://api.openai.com/v1"
    
    # Model Configuration
    default_model: str = "gpt-4o-mini"
    
    # Evaluation Configuration
    consistency_runs: int = 3
    hallucination_threshold: float = 0.8
    
    # Storage paths
    runs_directory: str = "./runs"
    suites_directory: str = "./suites"
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8002
    
    # RAG Service URL (for integration tests)
    rag_service_url: str = "http://localhost:8001"
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
