import redis.asyncio as redis
import json
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

class RedisManager:
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.pubsub = None
        
    async def initialize(self):
        """Initialize Redis connection with proper configuration"""
        try:
            self.redis_client = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_keepalive=True,
                socket_keepalive_options={},
                health_check_interval=30,
                max_connections=50
            )
            
            # Test connection
            await self.redis_client.ping()
            logger.info("Redis connection established successfully")
            
            # Initialize pub/sub
            self.pubsub = self.redis_client.pubsub()
            
        except Exception as e:
            logger.error(f"Failed to initialize Redis: {e}")
            raise
    
    async def close(self):
        """Close Redis connections"""
        if self.pubsub:
            await self.pubsub.close()
        if self.redis_client:
            await self.redis_client.close()
    
    def _prepare_redis_data(self, data: dict) -> dict:
        """Prepare data for Redis storage by converting None values to empty strings"""
        processed_data = {}
        for k, v in data.items():
            if v is None:
                processed_data[k] = ""  # Convert None to empty string
            else:
                processed_data[k] = v
        return processed_data
    
    # Agent Management
    async def set_agent_session(self, agent_id: str, session_data: dict):
        """Store agent session data"""
        key = f"agent:{agent_id}"
        session_data["last_activity"] = datetime.now(timezone.utc).isoformat()
        
        processed_data = self._prepare_redis_data(session_data)
        await self.redis_client.hset(key, mapping=processed_data)
        await self.redis_client.expire(key, 3600)  # 1 hour TTL
    
    async def get_agent_session(self, agent_id: str) -> Optional[dict]:
        """Get agent session data"""
        key = f"agent:{agent_id}"
        data = await self.redis_client.hgetall(key)
        return data if data else None
    
    async def remove_agent_session(self, agent_id: str):
        """Remove agent session"""
        await self.redis_client.delete(f"agent:{agent_id}")
    
    async def get_available_agents(self, organization_id: Optional[str] = None) -> List[dict]:
        """Get all available agents, optionally filtered by organization"""
        pattern = "agent:*"
        agents = []
        
        async for key in self.redis_client.scan_iter(match=pattern):
            agent_data = await self.redis_client.hgetall(key)
            if agent_data and agent_data.get("status") == "free":
                if organization_id is None or agent_data.get("organization_id") == organization_id:
                    agent_data["agent_id"] = key.split(":")[1]
                    agents.append(agent_data)
        
        return agents
    
    async def update_agent_status(self, agent_id: str, status: str):
        """Update agent status"""
        key = f"agent:{agent_id}"
        data = {
            "status": status,
            "last_activity": datetime.now(timezone.utc).isoformat()
        }
        processed_data = self._prepare_redis_data(data)
        await self.redis_client.hset(key, mapping=processed_data)
    
    # Call Management
    async def set_active_call(self, call_id: str, call_data: dict):
        """Store active call data"""
        key = f"call:{call_id}"
        call_data["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        processed_data = self._prepare_redis_data(call_data)
        await self.redis_client.hset(key, mapping=processed_data)
        await self.redis_client.expire(key, 7200)  # 2 hours TTL
    
    async def get_active_call(self, call_id: str) -> Optional[dict]:
        """Get active call data"""
        key = f"call:{call_id}"
        data = await self.redis_client.hgetall(key)
        return data if data else None
    
    async def remove_active_call(self, call_id: str):
        """Remove active call"""
        await self.redis_client.delete(f"call:{call_id}")
    
    async def get_active_calls_count(self) -> int:
        """Get total number of active calls"""
        pattern = "call:*"
        count = 0
        async for _ in self.redis_client.scan_iter(match=pattern):
            count += 1
        return count
    
    # WebSocket Management
    async def register_websocket_session(self, session_id: str, instance_id: str, agent_id: str):
        """Register WebSocket session"""
        key = f"ws:{session_id}"
        data = {
            "instance_id": instance_id,
            "agent_id": agent_id,
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        processed_data = self._prepare_redis_data(data)
        await self.redis_client.hset(key, mapping=processed_data)
        await self.redis_client.expire(key, 3600)
    
    async def get_websocket_session(self, session_id: str) -> Optional[dict]:
        """Get WebSocket session info"""
        key = f"ws:{session_id}"
        return await self.redis_client.hgetall(key)
    
    async def remove_websocket_session(self, session_id: str):
        """Remove WebSocket session"""
        await self.redis_client.delete(f"ws:{session_id}")
    
    # Pub/Sub Messaging
    async def publish_to_agent(self, agent_id: str, message: dict):
        """Publish message to specific agent across all instances"""
        channel = f"agent:{agent_id}"
        await self.redis_client.publish(channel, json.dumps(message))
    
    async def subscribe_to_agent_messages(self, agent_id: str):
        """Subscribe to agent-specific messages"""
        channel = f"agent:{agent_id}"
        await self.pubsub.subscribe(channel)
    
    async def publish_broadcast(self, message: dict):
        """Broadcast message to all instances"""
        await self.redis_client.publish("broadcast", json.dumps(message))
    
    async def subscribe_to_broadcast(self):
        """Subscribe to broadcast messages"""
        await self.pubsub.subscribe("broadcast")
    
    # Round Robin Management
    async def get_next_agent_round_robin(self, organization_id: Optional[str] = None) -> Optional[str]:
        """Get next agent using round-robin selection"""
        available_agents = await self.get_available_agents(organization_id)
        if not available_agents:
            return None
        
        key = f"rr:{organization_id or 'global'}"
        current_index = await self.redis_client.get(key)
        current_index = int(current_index) if current_index else 0
        
        # Get next index
        next_index = (current_index + 1) % len(available_agents)
        await self.redis_client.set(key, next_index, ex=3600)
        
        selected_agent = available_agents[current_index]
        return selected_agent["agent_id"]
    
    # Health and Monitoring
    async def get_system_stats(self) -> dict:
        """Get system statistics"""
        agent_count = 0
        free_agents = 0
        busy_agents = 0
        
        async for key in self.redis_client.scan_iter(match="agent:*"):
            agent_data = await self.redis_client.hgetall(key)
            if agent_data:
                agent_count += 1
                status = agent_data.get("status", "offline")
                if status == "free":
                    free_agents += 1
                elif status == "busy":
                    busy_agents += 1
        
        active_calls = await self.get_active_calls_count()
        
        return {
            "total_agents": agent_count,
            "free_agents": free_agents,
            "busy_agents": busy_agents,
            "active_calls": active_calls,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    # Additional utility methods
    async def get_all_agents(self) -> List[dict]:
        """Get all agents regardless of status"""
        pattern = "agent:*"
        agents = []
        
        async for key in self.redis_client.scan_iter(match=pattern):
            agent_data = await self.redis_client.hgetall(key)
            if agent_data:
                agent_data["agent_id"] = key.split(":")[1]
                agents.append(agent_data)
        
        return agents
    
    async def get_agent_by_status(self, status: str) -> List[dict]:
        """Get agents by specific status"""
        pattern = "agent:*"
        agents = []
        
        async for key in self.redis_client.scan_iter(match=pattern):
            agent_data = await self.redis_client.hgetall(key)
            if agent_data and agent_data.get("status") == status:
                agent_data["agent_id"] = key.split(":")[1]
                agents.append(agent_data)
        
        return agents
    
    async def cleanup_expired_sessions(self):
        """Clean up expired sessions (Redis expiration should handle this, but this is a backup)"""
        current_time = datetime.now(timezone.utc)
        pattern = "agent:*"
        
        async for key in self.redis_client.scan_iter(match=pattern):
            agent_data = await self.redis_client.hgetall(key)
            if agent_data and "last_activity" in agent_data:
                try:
                    last_activity = datetime.fromisoformat(agent_data["last_activity"])
                    if (current_time - last_activity).total_seconds() > 3600:  # 1 hour
                        await self.redis_client.delete(key)
                        logger.info(f"Cleaned up expired agent session: {key}")
                except (ValueError, TypeError):
                    # If last_activity is invalid, clean it up
                    await self.redis_client.delete(key)
                    logger.info(f"Cleaned up agent session with invalid timestamp: {key}")
    
    


async def get_agent_session_by_session_id(self, session_id: str) -> Optional[dict]:
    """Get agent session by session_id (from WebSocket)"""
    # Look for the WebSocket session in Redis
    websocket_data = await self.get_websocket_session(session_id)
    
    if websocket_data and websocket_data.get("agent_id"):
        agent_id = websocket_data["agent_id"]
        # Fetch the corresponding agent session using agent_id
        return await self.get_agent_session(agent_id)
    
    return None

