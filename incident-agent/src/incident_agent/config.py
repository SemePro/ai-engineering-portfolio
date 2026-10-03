"""Runtime configuration (environment variables)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(REPO_ROOT / ".env"), ".env"), extra="ignore", env_file_encoding="utf-8"
    )

    # Model access. Gateway mode is the platform default: the agent holds only a
    # gateway service key. Direct mode (ANTHROPIC_API_KEY, no GATEWAY_URL) is for
    # local development and running evals without the gateway.
    gateway_url: str | None = None
    gateway_service_key: str | None = None
    anthropic_api_key: str | None = None
    model: str = "claude-opus-5-5"
    effort: str = "medium"

    # Approval boundary
    approval_signing_secret: str = ""
    data_dir: Path = Path("./var")

    # Public demo controls
    demo_live_enabled: bool = False  # live model runs from the public site; off by default
    demo_sessions_per_ip_per_hour: int = 3
    demo_live_runs_per_session: int = 2
    demo_daily_live_runs: int = 40
    cors_origins: str = "http://localhost:3000,https://www.semefit.com,https://semefit.com"

    def model_credentials(self) -> tuple[str, str | None]:
        """(api_key, base_url) for the Anthropic SDK."""
        if self.gateway_url:
            if not self.gateway_service_key:
                raise RuntimeError("GATEWAY_URL is set but GATEWAY_SERVICE_KEY is missing")
            return self.gateway_service_key, self.gateway_url.rstrip("/")
        if self.anthropic_api_key:
            return self.anthropic_api_key, None
        raise RuntimeError("No model credentials: set GATEWAY_URL + GATEWAY_SERVICE_KEY, or ANTHROPIC_API_KEY")

    def has_model_credentials(self) -> bool:
        return bool((self.gateway_url and self.gateway_service_key) or self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
