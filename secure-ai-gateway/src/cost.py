"""Token counting and cost estimation utilities."""

import tiktoken
from typing import Optional

from .config import get_settings
from .models import CostMetadata


class CostEstimator:
    """Estimates token counts and API costs."""
    
    def __init__(
        self,
        cost_per_1k_input: Optional[float] = None,
        cost_per_1k_output: Optional[float] = None
    ):
        """Initialize the cost estimator."""
        settings = get_settings()
        self.cost_per_1k_input = cost_per_1k_input or settings.cost_per_1k_input_tokens
        self.cost_per_1k_output = cost_per_1k_output or settings.cost_per_1k_output_tokens
        
        # Use cl100k_base encoding (GPT-4, GPT-3.5-turbo)
        try:
            self.encoding = tiktoken.get_encoding("cl100k_base")
        except Exception:
            # Fallback to approximate counting if tiktoken fails
            self.encoding = None
    
    def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        if not text:
            return 0
        
        if self.encoding:
            return len(self.encoding.encode(text))
        else:
            # Rough approximation: ~4 chars per token
            return len(text) // 4
    
    def estimate(
        self,
        input_text: str,
        output_text: str
    ) -> CostMetadata:
        """
        Estimate cost for a request/response pair.
        
        Args:
            input_text: The input/prompt text
            output_text: The output/response text
            
        Returns:
            CostMetadata with token counts and cost estimate
        """
        input_tokens = self.count_tokens(input_text)
        output_tokens = self.count_tokens(output_text)
        total_tokens = input_tokens + output_tokens
        
        # Calculate cost
        input_cost = (input_tokens / 1000) * self.cost_per_1k_input
        output_cost = (output_tokens / 1000) * self.cost_per_1k_output
        total_cost = input_cost + output_cost
        
        return CostMetadata(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=round(total_cost, 6)
        )
