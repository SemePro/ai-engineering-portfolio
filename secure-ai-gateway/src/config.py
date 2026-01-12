"""Configuration management for Secure AI Gateway."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Upstream Services
    rag_service_url: str = "http://localhost:8001"
    eval_service_url: str = "http://localhost:8002"
    incident_service_url: str = "http://localhost:8003"
    devops_service_url: str = "http://localhost:8004"
    architecture_service_url: str = "http://localhost:8005"
    
    # Rate Limiting (Token Bucket)
    rate_limit_tokens: int = 100
    rate_limit_refill_rate: float = 10.0  # tokens per second
    rate_limit_per_ip: bool = True
    
    # Security Settings
    enable_pii_redaction: bool = True
    enable_injection_detection: bool = True
    log_requests: bool = True
    
    # Cost Estimation
    cost_per_1k_input_tokens: float = 0.0015
    cost_per_1k_output_tokens: float = 0.002
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
