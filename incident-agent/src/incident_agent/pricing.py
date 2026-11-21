"""Per-model token pricing (USD per million tokens).

Source: Anthropic published pricing as of 2026-09-25. Cache writes use the
5-minute TTL multiplier (1.25x input); cache reads are listed per model.
Update PRICES when pricing changes - every cost figure in eval artifacts
records the price table version it was computed with.
"""

from __future__ import annotations

from .schemas import Usage

PRICE_TABLE_VERSION = "2026-09-25"

PRICES: dict[str, dict[str, float]] = {
    "claude-opus-5-5": {"input": 4.00, "output": 20.00, "cache_read": 0.20, "cache_write": 5.00},
    "claude-sonnet-5-5": {"input": 2.00, "output": 10.00, "cache_read": 0.20, "cache_write": 2.50},
    "claude-haiku-4-5": {"input": 1.00, "output": 5.00, "cache_read": 0.10, "cache_write": 1.25},
}


def cost_usd(model: str, usage: Usage) -> float:
    p = PRICES.get(model)
    if p is None:
        return 0.0
    return (
        usage.input_tokens * p["input"]
        + usage.output_tokens * p["output"]
        + usage.cache_read_input_tokens * p["cache_read"]
        + usage.cache_creation_input_tokens * p["cache_write"]
    ) / 1_000_000
