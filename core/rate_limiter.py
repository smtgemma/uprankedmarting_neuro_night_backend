# core/rate_limiter.py
import asyncio
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Dict, Deque
from fastapi import HTTPException

class RateLimiter:
    def __init__(self, requests_per_minute: int = 100):
        self.requests_per_minute = requests_per_minute
        self.requests: Dict[str, Deque[float]] = defaultdict(deque)
        self.lock = asyncio.Lock()
    
    async def _cleanup_old_requests(self, key: str, now: float):
        """Remove requests older than 1 minute"""
        window_start = now - 60.0
        while self.requests[key] and self.requests[key][0] < window_start:
            self.requests[key].popleft()
    
    @asynccontextmanager
    async def acquire(self, key: str):
        """Rate limit based on key (e.g., user_id, org_id, etc.)"""
        async with self.lock:
            now = time.time()
            await self._cleanup_old_requests(key, now)
            
            if len(self.requests[key]) >= self.requests_per_minute:
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Max {self.requests_per_minute} requests per minute."
                )
            
            self.requests[key].append(now)
        
        try:
            yield
        finally:
            pass  # Cleanup happens in next request


