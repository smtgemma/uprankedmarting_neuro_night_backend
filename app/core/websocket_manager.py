from fastapi import WebSocket
from typing import Dict
import json
import asyncio
import logging
from .redis_manager import RedisManager
from .config import settings

logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self, redis_manager: RedisManager):
        self.redis_manager = redis_manager
        self.local_connections: Dict[str, WebSocket] = {}
        self.agent_sessions: Dict[str, str] = {}  # agent_id -> session_id
        self.instance_id = settings.INSTANCE_ID
        self._running = False
        self._message_listener_task = None

    # --- New method ---
    def is_agent_registered(self, agent_id: str) -> bool:
        """Check if the agent is already registered in any session"""
        return agent_id in self.agent_sessions
    
    async def start_message_listener(self):
        """Start listening for Redis pub/sub messages"""
        if self._running:
            return
        
        self._running = True
        self._message_listener_task = asyncio.create_task(self._message_listener())
    
    async def stop_message_listener(self):
        """Stop listening for Redis pub/sub messages"""
        self._running = False
        if self._message_listener_task:
            self._message_listener_task.cancel()
            try:
                await self._message_listener_task
            except asyncio.CancelledError:
                pass
    
    async def _message_listener(self):
        """Listen for messages from Redis pub/sub"""
        try:
            await self.redis_manager.subscribe_to_broadcast()
            
            async for message in self.redis_manager.pubsub.listen():
                if not self._running:
                    break
                
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        await self._handle_redis_message(data)
                    except Exception as e:
                        logger.error(f"Failed to handle Redis message: {e}")
                        
        except Exception as e:
            logger.error(f"Message listener error: {e}")
    
    async def _handle_redis_message(self, data: dict):
        """Handle incoming Redis messages"""
        message_type = data.get("type")
        target_agent = data.get("target_agent")
        
        if target_agent and target_agent in self.agent_sessions:
            session_id = self.agent_sessions[target_agent]
            if session_id in self.local_connections:
                await self.send_to_connection(session_id, data)
    
    async def connect(self, websocket: WebSocket, session_id: str):
        """Accept WebSocket connection"""
        await websocket.accept()
        self.local_connections[session_id] = websocket
        logger.info(f"WebSocket connected: {session_id} on instance {self.instance_id}")
    
    async def disconnect(self, session_id: str):
        """Handle WebSocket disconnection"""
        if session_id in self.local_connections:
            del self.local_connections[session_id]
        
        # Find and cleanup agent session
        agent_id_to_remove = None
        for agent_id, sess_id in self.agent_sessions.items():
            if sess_id == session_id:
                agent_id_to_remove = agent_id
                break
        
        if agent_id_to_remove:
            del self.agent_sessions[agent_id_to_remove]
            await self.redis_manager.remove_agent_session(agent_id_to_remove)
            await self.redis_manager.remove_websocket_session(session_id)
        
        logger.info(f"WebSocket disconnected: {session_id}")
    
    async def register_agent(self, session_id: str, agent_id: str, agent_data: dict):
        """Register agent with session"""
        # Handle reconnection: only disconnect if session changed
        if self.is_agent_registered(agent_id):
            old_session_id = self.agent_sessions[agent_id]
            if old_session_id != session_id:
                await self.disconnect(old_session_id)
                logger.warning(f"Agent {agent_id} reconnected, old session {old_session_id} disconnected")
            else:
                # Already registered with same session, skip everything
                logger.info(f"Agent {agent_id} already registered with same session {session_id}, skipping registration")
                return  # <--- Skip re-registration entirely
        
        # Register agent
        self.agent_sessions[agent_id] = session_id
        
        # Store in Redis
        await self.redis_manager.register_websocket_session(
            session_id, self.instance_id, agent_id
        )
        await self.redis_manager.set_agent_session(agent_id, agent_data)
        
        logger.info(f"Agent {agent_id} registered with session {session_id}")

    
    async def send_to_connection(self, session_id: str, message: dict):
        """Send message to specific WebSocket connection"""
        if session_id in self.local_connections:
            try:
                websocket = self.local_connections[session_id]
                await websocket.send_text(json.dumps(message))
                return True
            except Exception as e:
                logger.error(f"Failed to send message to {session_id}: {e}")
                await self.disconnect(session_id)
        return False
    
    async def send_to_agent(self, agent_id: str, message: dict):
        """Send message to specific agent (local or remote)"""
        # Try local connection first
        if agent_id in self.agent_sessions:
            session_id = self.agent_sessions[agent_id]
            if await self.send_to_connection(session_id, message):
                return True
        
        # Publish to Redis for other instances
        message["target_agent"] = agent_id
        await self.redis_manager.publish_broadcast(message)
        return True
    
    async def broadcast_message(self, message: dict):
        """Broadcast message to all local connections"""
        disconnected = []
        for session_id, websocket in self.local_connections.items():
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to broadcast to {session_id}: {e}")
                disconnected.append(session_id)
        
        # Cleanup disconnected sessions
        for session_id in disconnected:
            await self.disconnect(session_id)
        
        # Also broadcast via Redis to other instances
        await self.redis_manager.publish_broadcast(message)
