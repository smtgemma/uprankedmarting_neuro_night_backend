#app/services/queue_service.py
from typing import Dict, List, Optional
from datetime import datetime
from app.models.agent import Agent, Caller, AgentStatus, QueueUpdate
from app.services.websocket_service import websocket_service

class QueueService:
    def __init__(self):
        self.agents: Dict[str, Agent] = {}
        self.callers: Dict[str, Caller] = {}
        self.queue_position_counter = 1
    
    def add_agent(self, agent_id: str, agent_name: str) -> Agent:
        """Add or update an agent"""
        agent = Agent(
            id=agent_id,
            name=agent_name,
            status=AgentStatus.AVAILABLE,
            login_time=datetime.now()
        )
        self.agents[agent_id] = agent
        self._broadcast_update("agent_status_changed", {
            "agent": agent.dict(),
            "action": "logged_in"
        })
        return agent
    
    def remove_agent(self, agent_id: str):
        """Remove an agent"""
        if agent_id in self.agents:
            agent = self.agents[agent_id]
            agent.status = AgentStatus.OFFLINE
            self._broadcast_update("agent_status_changed", {
                "agent": agent.dict(),
                "action": "logged_out"
            })
            del self.agents[agent_id]
    
    def get_available_agent(self) -> Optional[Agent]:
        """Get the first available agent"""
        for agent in self.agents.values():
            if agent.status == AgentStatus.AVAILABLE:
                return agent
        return None
    
    def set_agent_busy(self, agent_id: str, call_sid: str):
        """Mark agent as busy with a call"""
        if agent_id in self.agents:
            self.agents[agent_id].status = AgentStatus.BUSY
            self.agents[agent_id].current_call_sid = call_sid
            self.agents[agent_id].total_calls += 1
            self._broadcast_update("agent_status_changed", {
                "agent": self.agents[agent_id].dict(),
                "action": "busy"
            })
    
    def set_agent_available(self, agent_id: str):
        """Mark agent as available"""
        if agent_id in self.agents:
            self.agents[agent_id].status = AgentStatus.AVAILABLE
            self.agents[agent_id].current_call_sid = None
            self._broadcast_update("agent_status_changed", {
                "agent": self.agents[agent_id].dict(),
                "action": "available"
            })
    
    def add_caller(self, call_sid: str, phone_number: str) -> Caller:
        """Add caller to queue"""
        caller = Caller(
            call_sid=call_sid,
            phone_number=phone_number,
            queue_position=self.queue_position_counter,
            wait_time=0,
            enqueue_time=datetime.now()
        )
        self.callers[call_sid] = caller
        self.queue_position_counter += 1
        
        self._broadcast_update("caller_joined", {
            "caller": caller.dict(),
            "queue_size": len(self.callers)
        })
        return caller
    
    def remove_caller(self, call_sid: str):
        """Remove caller from queue"""
        if call_sid in self.callers:
            caller = self.callers[call_sid]
            del self.callers[call_sid]
            self._broadcast_update("caller_dequeued", {
                "caller": caller.dict(),
                "queue_size": len(self.callers)
            })
    
    def get_queue_status(self) -> dict:
        """Get current queue status"""
        # Update wait times
        current_time = datetime.now()
        callers_data = []
        
        for caller in self.callers.values():
            wait_seconds = int((current_time - caller.enqueue_time).total_seconds())
            caller_dict = {
                "call_sid": caller.call_sid,
                "phone_number": caller.phone_number,
                "queue_position": caller.queue_position,
                "wait_time": wait_seconds,
                "enqueue_time": caller.enqueue_time.isoformat()
            }
            callers_data.append(caller_dict)
        
        agents_data = []
        for agent in self.agents.values():
            agent_dict = {
                "id": agent.id,
                "name": agent.name,
                "status": agent.status,
                "current_call_sid": agent.current_call_sid,
                "total_calls": agent.total_calls,
                "login_time": agent.login_time.isoformat() if agent.login_time else None
            }
            agents_data.append(agent_dict)
        
        return {
            "callers": callers_data,
            "agents": agents_data,
            "queue_size": len(self.callers),
            "available_agents": len([a for a in self.agents.values() if a.status == AgentStatus.AVAILABLE])
        }
    
    def _broadcast_update(self, update_type: str, data: dict):
        """Broadcast update to all connected clients"""
        update = QueueUpdate(type=update_type, data=data)
        websocket_service.broadcast(update.dict())

queue_service = QueueService()