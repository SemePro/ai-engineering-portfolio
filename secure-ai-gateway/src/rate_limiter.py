"""Token bucket rate limiter implementation."""

import time
from threading import Lock
from typing import Dict, Tuple


class TokenBucket:
    """
    Token bucket rate limiter.
    
    Tokens are consumed for each request and refilled at a constant rate.
    When tokens are exhausted, requests are rejected.
    """
    
    def __init__(self, capacity: int, refill_rate: float):
        """
        Initialize a token bucket.
        
        Args:
            capacity: Maximum tokens in the bucket
            refill_rate: Tokens added per second
        """
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = float(capacity)
        self.last_refill = time.time()
        self.lock = Lock()
    
    def _refill(self) -> None:
        """Refill tokens based on elapsed time."""
        now = time.time()
        elapsed = now - self.last_refill
        tokens_to_add = elapsed * self.refill_rate
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill = now
    
    def consume(self, tokens: int = 1) -> Tuple[bool, int]:
        """
        Attempt to consume tokens.
        
        Args:
            tokens: Number of tokens to consume
            
        Returns:
            Tuple of (success, remaining_tokens)
        """
        with self.lock:
            self._refill()
            
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True, int(self.tokens)
            else:
                return False, int(self.tokens)
    
    def get_remaining(self) -> int:
        """Get current token count."""
        with self.lock:
            self._refill()
            return int(self.tokens)


class RateLimiter:
    """
    Rate limiter manager supporting per-IP limiting.
    """
    
    def __init__(self, capacity: int, refill_rate: float, per_ip: bool = True):
        """
        Initialize the rate limiter.
        
        Args:
            capacity: Token bucket capacity
            refill_rate: Token refill rate per second
            per_ip: If True, maintain separate buckets per IP
        """
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.per_ip = per_ip
        
        # Global bucket (used when per_ip is False)
        self._global_bucket = TokenBucket(capacity, refill_rate)
        
        # Per-IP buckets
        self._ip_buckets: Dict[str, TokenBucket] = {}
        self._lock = Lock()
    
    def _get_bucket(self, client_ip: str) -> TokenBucket:
        """Get or create a bucket for the given IP."""
        if not self.per_ip:
            return self._global_bucket
        
        with self._lock:
            if client_ip not in self._ip_buckets:
                self._ip_buckets[client_ip] = TokenBucket(
                    self.capacity,
                    self.refill_rate
                )
            return self._ip_buckets[client_ip]
    
    def check(self, client_ip: str, tokens: int = 1) -> Tuple[bool, int]:
        """
        Check if request should be allowed.
        
        Args:
            client_ip: Client IP address
            tokens: Tokens to consume
            
        Returns:
            Tuple of (allowed, remaining_tokens)
        """
        bucket = self._get_bucket(client_ip)
        return bucket.consume(tokens)
    
    def get_remaining(self, client_ip: str) -> int:
        """Get remaining tokens for a client."""
        bucket = self._get_bucket(client_ip)
        return bucket.get_remaining()
