from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, generate_latest
import time
from functools import wraps

# Create custom registry
REGISTRY = CollectorRegistry()

# Metrics
ACTIVE_CALLS = Gauge('callcenter_active_calls_total', 'Number of active calls', registry=REGISTRY)
ACTIVE_AGENTS = Gauge('callcenter_active_agents_total', 'Number of active agents', registry=REGISTRY)
CALL_DURATION = Histogram('callcenter_call_duration_seconds', 'Call duration in seconds', registry=REGISTRY)
CALLS_TOTAL = Counter('callcenter_calls_total', 'Total number of calls', ['status'], registry=REGISTRY)
WEBSOCKET_CONNECTIONS = Gauge('callcenter_websocket_connections', 'Number of WebSocket connections', registry=REGISTRY)
AGENT_STATUS = Gauge('callcenter_agent_status', 'Agent status', ['agent_id', 'status'], registry=REGISTRY)

def track_call_duration(func):
    """Decorator to track call duration"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            CALL_DURATION.observe(time.time() - start_time)
            return result
        except Exception as e:
            CALL_DURATION.observe(time.time() - start_time)
            raise
    return wrapper

async def update_metrics(redis_manager):
    """Update metrics from Redis data"""
    stats = await redis_manager.get_system_stats()
    
    ACTIVE_CALLS.set(stats["active_calls"])
    ACTIVE_AGENTS.set(stats["total_agents"])
    
    # Update WebSocket connections count
    ws_count = 0
    async for _ in redis_manager.redis_client.scan_iter(match="ws:*"):
        ws_count += 1
    WEBSOCKET_CONNECTIONS.set(ws_count)

def get_metrics():
    """Get metrics in Prometheus format"""
    return generate_latest(REGISTRY)