# app/routes/agent.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.twilio_service import twilio_service
from app.services.queue_service import queue_service
from app.utils.auth import auth_utils

router = APIRouter(prefix="/agent")

class AgentLogin(BaseModel):
    agent_id: str
    agent_name: str

class AnswerCall(BaseModel):
    call_sid: str
    agent_id: str

@router.post("/login")
async def agent_login(login_data: AgentLogin):
    """Agent login endpoint"""
    try:
        # Validate credentials
        if not auth_utils.validate_agent_credentials(login_data.agent_id, login_data.agent_name):
            raise HTTPException(status_code=400, detail="Invalid agent credentials")
        
        # Add agent to queue service
        agent = queue_service.add_agent(login_data.agent_id, login_data.agent_name)
        
        # Generate real Twilio access token for WebRTC
        try:
            access_token = twilio_service.generate_access_token(login_data.agent_id)
        except Exception as e:
            print(f"Error generating access token: {e}")
            raise HTTPException(status_code=500, detail="Failed to generate access token")
        
        return {
            "success": True,
            "agent": agent.dict(),
            "access_token": access_token
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    

    
@router.post("/logout/{agent_id}")
async def agent_logout(agent_id: str):
    """Agent logout endpoint"""
    try:
        queue_service.remove_agent(agent_id)
        return {"success": True, "message": "Agent logged out successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/answer-call")
async def answer_call(answer_data: AnswerCall):
    """Answer a queued call"""
    try:
        # Check if agent is available
        agent = queue_service.agents.get(answer_data.agent_id)
        if not agent or agent.status != "available":
            raise HTTPException(status_code=400, detail="Agent not available")
        
        # In the answer_call function, after checking agent availability:
        print("Attempting to dequeue call...")

        # Mark agent as busy BEFORE dequeuing
        queue_service.set_agent_busy(answer_data.agent_id, answer_data.call_sid)

        success = twilio_service.dequeue_call(answer_data.call_sid, answer_data.agent_id)
        print(f"Dequeue result: {success}")

        if success:
            return {"success": True, "message": "Call connected to agent"}
        else:
            # Revert agent status if failed
            queue_service.set_agent_available(answer_data.agent_id)
            raise HTTPException(status_code=500, detail="Failed to connect call")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/status/{agent_id}")
async def get_agent_status(agent_id: str):
    """Get agent status"""
    agent = queue_service.agents.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return agent.dict()