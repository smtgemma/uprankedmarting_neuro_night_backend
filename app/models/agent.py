#app/models/agent.py

from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

class AgentStatus(str, Enum):
    AVAILABLE = "available"
    BUSY = "busy"
    OFFLINE = "offline"

class Agent(BaseModel):
    id: str
    name: str
    status: AgentStatus = AgentStatus.OFFLINE
    current_call_sid: Optional[str] = None
    login_time: Optional[datetime] = None
    total_calls: int = 0
    
    
    def dict(self, **kwargs):
        result = super().dict(**kwargs)
        # Convert datetime objects to ISO strings
        if 'login_time' in result and result['login_time']:
            result['login_time'] = result['login_time'].isoformat()
        if 'enqueue_time' in result and result['enqueue_time']:
            result['enqueue_time'] = result['enqueue_time'].isoformat()
        return result

class Caller(BaseModel):
    call_sid: str
    phone_number: str
    queue_position: int
    wait_time: int
    enqueue_time: datetime

    def dict(self, **kwargs):
        result = super().dict(**kwargs)
        # Convert datetime objects to ISO strings
        if 'login_time' in result and result['login_time']:
            result['login_time'] = result['login_time'].isoformat()
        if 'enqueue_time' in result and result['enqueue_time']:
            result['enqueue_time'] = result['enqueue_time'].isoformat()
        return result

class QueueUpdate(BaseModel):
    type: str  # "caller_joined", "caller_dequeued", "agent_status_changed"
    data: Dict[str, Any]