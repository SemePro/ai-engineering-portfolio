"""Tests for rate limiter."""

import pytest
import time
from src.rate_limiter import TokenBucket, RateLimiter


class TestTokenBucket:
    """Tests for token bucket implementation."""
    
    def test_initial_capacity(self):
        """Bucket should start at full capacity."""
        bucket = TokenBucket(capacity=10, refill_rate=1.0)
        assert bucket.get_remaining() == 10
    
    def test_consume_tokens(self):
        """Should consume tokens correctly."""
        bucket = TokenBucket(capacity=10, refill_rate=0)
        
        success, remaining = bucket.consume(3)
        assert success is True
        assert remaining == 7
    
    def test_consume_exceeds_available(self):
        """Should reject when not enough tokens."""
        bucket = TokenBucket(capacity=5, refill_rate=0)
        
        success, remaining = bucket.consume(10)
        assert success is False
        assert remaining == 5  # Unchanged
    
    def test_refill_over_time(self):
        """Tokens should refill over time."""
        bucket = TokenBucket(capacity=10, refill_rate=100.0)  # Fast refill
        
        # Consume all tokens
        bucket.consume(10)
        assert bucket.get_remaining() == 0
        
        # Wait for refill
        time.sleep(0.05)  # 50ms = 5 tokens at 100/s
        
        remaining = bucket.get_remaining()
        assert remaining >= 4  # Allow some timing variance
    
    def test_refill_capped_at_capacity(self):
        """Refill should not exceed capacity."""
        bucket = TokenBucket(capacity=10, refill_rate=100.0)
        
        time.sleep(0.2)  # Would add 20 tokens
        
        assert bucket.get_remaining() == 10


class TestRateLimiter:
    """Tests for rate limiter manager."""
    
    def test_per_ip_limiting(self):
        """Different IPs should have separate limits."""
        limiter = RateLimiter(capacity=5, refill_rate=0, per_ip=True)
        
        # IP 1 consumes tokens
        limiter.check("192.168.1.1")
        limiter.check("192.168.1.1")
        limiter.check("192.168.1.1")
        
        # IP 2 should have full capacity
        allowed, remaining = limiter.check("192.168.1.2")
        assert allowed is True
        assert remaining == 4  # Just consumed 1
    
    def test_global_limiting(self):
        """Global mode should share limit across IPs."""
        limiter = RateLimiter(capacity=5, refill_rate=0, per_ip=False)
        
        # Different IPs share the same bucket
        limiter.check("192.168.1.1")
        limiter.check("192.168.1.2")
        limiter.check("192.168.1.3")
        
        allowed, remaining = limiter.check("192.168.1.4")
        assert allowed is True
        assert remaining == 1  # 5 - 4 = 1
    
    def test_rate_limit_exceeded(self):
        """Should reject when limit exceeded."""
        limiter = RateLimiter(capacity=3, refill_rate=0, per_ip=True)
        
        ip = "192.168.1.1"
        limiter.check(ip)
        limiter.check(ip)
        limiter.check(ip)
        
        allowed, _ = limiter.check(ip)
        assert allowed is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
