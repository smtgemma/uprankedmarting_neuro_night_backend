# core/circuit_breaker.py
import asyncio
import time
from contextlib import asynccontextmanager
from enum import Enum
from typing import Optional
from fastapi import HTTPException

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.state = CircuitState.CLOSED
        self.lock = asyncio.Lock()
    
    async def _should_attempt_reset(self) -> bool:
        """Check if circuit breaker should attempt reset"""
        if self.state == CircuitState.OPEN and self.last_failure_time:
            return time.time() - self.last_failure_time >= self.timeout
        return False
    
    @asynccontextmanager
    async def call(self):
        """Circuit breaker context manager"""
        async with self.lock:
            if self.state == CircuitState.OPEN:
                if await self._should_attempt_reset():
                    self.state = CircuitState.HALF_OPEN
                else:
                    raise HTTPException(
                        status_code=503,
                        detail="Service temporarily unavailable due to high failure rate"
                    )
        
        try:
            yield
            # Success - reset failure count
            async with self.lock:
                self.failure_count = 0
                if self.state == CircuitState.HALF_OPEN:
                    self.state = CircuitState.CLOSED
        except Exception as e:
            # Failure - increment count
            async with self.lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                
                if self.failure_count >= self.failure_threshold:
                    self.state = CircuitState.OPEN
            raise

