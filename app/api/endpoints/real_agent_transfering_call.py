from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse, Response
from fastapi.security import HTTPBearer
from pydantic import BaseModel, field_validator, Field
from typing import Optional, Dict
import asyncio
import json
import logging
from datetime import datetime, timezone
from bson import ObjectId
from twilio.twiml.voice_response import VoiceResponse, Dial
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from twilio.rest import Client
import httpx
import jwt
import httpx
from openai import OpenAI
import re
import uuid

from app.core.config import settings
from app.core.metrics import (
    CALLS_TOTAL, ACTIVE_CALLS, track_call_duration, 
    update_metrics, get_metrics
)
from app.services.shared_state import get_shared_state
from app.db.database_connection import get_database
from app.api.models.ai_agent_model import Call, CallStatus, CallType

openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(tags=["Real Agent Call Service"])

# Models
class AgentStatusUpdate(BaseModel):
    status: str

    @field_validator('status')
    def validate_status(cls, v):
        if v not in {"offline", "free", "busy"}:
            raise ValueError('Status must be offline, free, or busy')
        return v

class TokenRefreshRequest(BaseModel):
    refresh_token: str

# class OutboundCallRequest(BaseModel):
#     to_number: str = Field(
#         ..., 
#         example="+15551234567", 
#         description="The recipient's phone number in E.164 format."
#     )

class OutboundCallRequest(BaseModel):
    to_number: str
    from_number: str = None  # Optional, will use organization's number if not provided

class CallStatusUpdate(BaseModel):
    call_sid: str
    status: str
    duration: int = None

# Authentication
security = HTTPBearer()

twilio_client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

async def get_current_agent(credentials=Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token, 
            settings.JWT_ACCESS_SECRET, 
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_aud": False, "verify_iss": False}
        )
        logger.debug(f"JWT payload: {payload}")
        required_fields = ["id", "email", "sip"]
        for field in required_fields:
            if field not in payload:
                logger.error(f"Missing field {field} in token")
                raise HTTPException(status_code=403, detail=f"Missing {field} in token")
        if not payload["sip"].get("sip_username"):
            logger.error("No SIP credentials in token")
            raise HTTPException(status_code=403, detail="No SIP credentials in token")
        
        return {
            "agent_id": payload["id"],
            "email": payload["email"],
            "name": payload.get("name", ""),
            "role": payload.get("role", ""),
            "is_verified": payload.get("isVerified", False),
            "sip_username": payload["sip"]["sip_username"],
            "sip_password": payload["sip"]["sip_password"],
            "sip_address": payload["sip"]["sip_address"]
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid token: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

# Helper Functions
async def determine_organization_from_call(db_manager, redis_manager, called_number: str) -> Optional[str]:
    """Map called number to organization ID with caching"""
    cache_key = f"number_org:{called_number}"
    cached_org = await redis_manager.redis_client.get(cache_key)
    if cached_org:
        return cached_org if cached_org != "null" else None
    
    subscription = await db_manager.db.subscriptions.find_one({
        "purchasedNumber": called_number,
        "status": "ACTIVE"
    })
    
    org_id = None
    if subscription and subscription.get("organizationId"):
        org_id = subscription["organizationId"]
        if isinstance(org_id, ObjectId):
            org_id = str(org_id)
        elif isinstance(org_id, dict) and "$oid" in org_id:
            org_id = org_id["$oid"]
    
    await redis_manager.redis_client.setex(
        cache_key, 300, org_id or "null"
    )
    
    logger.info(f"Mapped number {called_number} to organization {org_id}")
    return org_id

async def find_best_available_agent(redis_manager, organization_id: Optional[str] = None) -> Optional[str]:
    """Find the best available agent using improved round-robin with fallback"""
    if organization_id:
        agent_id = await redis_manager.get_next_agent_round_robin(organization_id)
        if agent_id:
            logger.info(f"Found agent {agent_id} for organization {organization_id}")
            return agent_id
    
    agent_id = await redis_manager.get_next_agent_round_robin(None)
    if agent_id:
        logger.info(f"Using fallback agent {agent_id} from global pool")
        return agent_id
    
    logger.warning("No available agents found")
    return None

async def get_agent_organization_info(agent_id: str):
    """Get organization information for an agent"""
    try:
        # Convert agent_id to ObjectId if it's a string
        if isinstance(agent_id, str):
            try:
                agent_obj_id = ObjectId(agent_id)
            except:
                raise HTTPException(status_code=400, detail="Invalid agent ID format")
        else:
            agent_obj_id = agent_id

        db = get_database()

        # Get the agent record
        agent = await db.agents.find_one({
            "userId": agent_obj_id
        })
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent record not found")
        
        # Get the organization the agent is assigned to
        organization_id = agent.get("assignTo")
        if not organization_id:
            raise HTTPException(status_code=404, detail="Agent not assigned to any organization")
        
        # Convert to ObjectId if it's a string
        if isinstance(organization_id, str):
            try:
                organization_obj_id = ObjectId(organization_id)
            except:
                raise HTTPException(status_code=400, detail="Invalid organization ID")
        else:
            organization_obj_id = organization_id
        
        # Get organization details
        organization = await db.organizations.find_one({
            "_id": organization_obj_id
        })
        print("Organization Id", organization_obj_id)
        
        
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Get the organization's phone number from subscriptions
        subscription = await db.subscriptions.find_one({
            "organizationId": organization_obj_id,
            "status": "ACTIVE"
        })
        print("subscription", subscription)
        
        if not subscription or not subscription.get("purchasedNumber"):
            raise HTTPException(status_code=404, detail="No active phone number found for organization")
        
        return {
            "organization": {
                "id": str(organization["_id"]),
                "name": organization.get("name", "Unknown Organization"),
                "phoneNumber": subscription["purchasedNumber"]
            },
            "agent": {
                "id": str(agent["_id"]),
                "userId": str(agent["userId"]),
                "jobTitle": agent.get("jobTitle", ""),
                "department": agent.get("department", "")
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting organization info for agent {agent_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch organization information")

async def handle_websocket_message(shared_state, session_id: str, message: dict):
    message_type = message.get("type")
    logger.debug(f"Handling WebSocket message type {message_type} for session {session_id}")
    
    if message_type == "agent_register":
        data = message.get("data", {})
        agent_id = data.get("agent_id")
        
        if not agent_id:
            logger.error(f"Agent registration failed for session {session_id}: No agent_id provided")
            await shared_state.websocket_manager.send_to_connection(session_id, {
                "type": "registration_error",
                "data": {"message": "Agent ID required"}
            })
            return
        
        if "token" not in data:
            logger.error(f"Agent registration failed for session {session_id}: No token provided")
            await shared_state.websocket_manager.send_to_connection(session_id, {
                "type": "registration_error",
                "data": {"message": "Authentication token required"}
            })
            return
        
        try:
            token_data = jwt.decode(
                data["token"], 
                settings.JWT_ACCESS_SECRET, 
                algorithms=[settings.JWT_ALGORITHM]
            )
            if not token_data.get("isVerified", False):
                logger.error(f"Agent registration failed for session {session_id}: User not verified")
                await shared_state.websocket_manager.send_to_connection(session_id, {
                    "type": "registration_error",
                    "data": {"message": "User not verified"}
                })
                return
        except jwt.InvalidTokenError:
            logger.error(f"Agent registration failed for session {session_id}: Invalid token")
            await shared_state.websocket_manager.send_to_connection(session_id, {
                "type": "registration_error", 
                "data": {"message": "Invalid token"}
            })
            return
        
        # Get agent from database
        agent = await shared_state.db_manager.db.agents.find_one({"userId": ObjectId(agent_id)})
        if not agent:
            logger.error(f"Agent registration failed for session {session_id}: Agent not found")
            await shared_state.websocket_manager.send_to_connection(session_id, {
                "type": "registration_error",
                "data": {"message": "Agent not found"}
            })
            return
        
        # Prepare agent session data
        organization_id = str(agent.get("assignTo")) if agent.get("assignTo") else None
        agent_session_data = {
            "agent_id": agent_id,
            "user_id": str(agent["userId"]),
            "sip_username": agent["sip_username"],
            "sip_password": agent["sip_password"],
            "sip_address": agent["sip_address"],
            "status": "free",
            "organization_id": organization_id,
            "instance_id": settings.INSTANCE_ID,
            "session_id": session_id
        }

        # Prevent duplicate registration
        if shared_state.websocket_manager.is_agent_registered(agent_id):
            old_session_id = shared_state.websocket_manager.agent_sessions[agent_id]
            if old_session_id != session_id:  # Only disconnect if it's a different session
                await shared_state.websocket_manager.disconnect(old_session_id)
                logger.warning(f"Agent {agent_id} reconnected, old session {old_session_id} disconnected")

        # Register agent
        await shared_state.websocket_manager.register_agent(session_id, agent_id, agent_session_data)
        
        # Update Redis and database
        await shared_state.redis_manager.update_agent_status(agent_id, "free")
        await shared_state.db_manager.db.agents.update_one(
            {"userId": ObjectId(agent_id)},
            {"$set": {"status": "free", "last_activity": datetime.now(timezone.utc)}}
        )

        logger.info(f"Agent {agent_id} registered successfully for session {session_id}")

        await shared_state.websocket_manager.send_to_connection(session_id, {
            "type": "registration_success",
            "data": {
                "agent_id": agent_id,
                "sip_username": agent["sip_username"],
                "sip_address": agent["sip_address"],
                "status": "free",
                "organization_id": organization_id,
                "instance_id": settings.INSTANCE_ID,
                "message": "Successfully registered with scalable backend"
            }
        })

    elif message_type == "status_update":
        data = message.get("data", {})
        agent_id = data.get("agent_id")
        new_status = data.get("status")
        
        if not agent_id or not new_status:
            logger.error(f"Status update failed for session {session_id}: Missing agent_id or status")
            await shared_state.websocket_manager.send_to_connection(session_id, {
                "type": "error",
                "data": {"message": "Agent ID and status required"}
            })
            return
        
        if new_status not in ["offline", "free", "busy"]:
            logger.error(f"Status update failed for session {session_id}: Invalid status {new_status}")
            await shared_state.websocket_manager.send_to_connection(session_id, {
                "type": "error",
                "data": {"message": "Invalid status"}
            })
            return
        
        try:
            await shared_state.redis_manager.update_agent_status(agent_id, new_status)
            await shared_state.db_manager.db.agents.update_one(
                {"userId": ObjectId(agent_id)},
                {"$set": {"status": new_status, "last_activity": datetime.now(timezone.utc)}}
            )
            logger.info(f"Agent {agent_id} status updated to {new_status} for session {session_id}")
            await shared_state.websocket_manager.send_to_connection(session_id, {
                "type": "status_updated",
                "data": {"agent_id": agent_id, "status": new_status}
            })
        except Exception as e:
            logger.error(f"Status update failed for agent {agent_id}: {str(e)}")
            await shared_state.websocket_manager.send_to_connection(session_id, {
                "type": "error",
                "data": {"message": str(e)}
            })

    elif message_type == "ping":
        try:
            await shared_state.websocket_manager.send_to_connection(session_id, {
                "type": "pong",
                "data": {"timestamp": datetime.now(timezone.utc).isoformat()}
            })
            logger.debug(f"Sent pong response for session {session_id}")
        except Exception as e:
            logger.error(f"Failed to send pong for session {session_id}: {str(e)}")
            await shared_state.websocket_manager.send_to_connection(session_id, {
                "type": "error",
                "data": {"message": f"Failed to send pong: {str(e)}"}
            })
    
    else:
        logger.warning(f"Unknown message type {message_type} for session {session_id}")
        await shared_state.websocket_manager.send_to_connection(session_id, {
            "type": "error",
            "data": {"message": f"Unknown message type: {message_type}"}
        })


# Health Check Endpoints
@router.get("/health")
async def health_check(request: Request):
    """Enhanced health check with detailed system status"""
    shared_state = get_shared_state(request.app)
    
    try:
        stats = await shared_state.redis_manager.get_system_stats()
        
        # Test Redis connection
        await shared_state.redis_manager.redis_client.ping()
        redis_status = "healthy"
        
        # Test MongoDB connection
        await shared_state.db_manager.client.admin.command('ping')
        mongo_status = "healthy"
        
        # Check available agents
        agent_count = await shared_state.redis_manager.redis_client.scard("agents:free:global")
        
        return {
            "status": "healthy" if shared_state.health_status.backend_healthy else "unhealthy",
            "instance_id": settings.INSTANCE_ID,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "last_health_check": shared_state.health_status.last_health_check.isoformat(),
            "consecutive_failures": shared_state.health_status.consecutive_failures,
            "services": {
                "redis": redis_status,
                "mongodb": mongo_status,
                "websocket": "healthy",
                "twilio": "connected"
            },
            "metrics": stats,
            "available_agents": agent_count
        }
    except Exception as e:
        shared_state.health_status.consecutive_failures += 1
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e),
                "instance_id": settings.INSTANCE_ID,
                "consecutive_failures": shared_state.health_status.consecutive_failures
            }
        )

@router.get("/health/simple")
async def simple_health_check(request: Request):
    """Simple health check for load balancers"""
    shared_state = get_shared_state(request.app)
    
    if shared_state.health_status.backend_healthy:
        return {"status": "ok"}
    else:
        return JSONResponse(
            status_code=503,
            content={"status": "error"}
        )

@router.get("/twilio/health-check")
async def twilio_health_check(request: Request):
    """Health check endpoint specifically for Twilio webhook validation"""
    shared_state = get_shared_state(request.app)
    
    try:
        # Quick health checks
        await shared_state.redis_manager.redis_client.ping()
        agent_count = await shared_state.redis_manager.redis_client.scard("agents:free:global")
        
        return {
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "instance_id": settings.INSTANCE_ID,
            "available_agents": agent_count,
            "ready_for_calls": agent_count > 0
        }
    except Exception as e:
        logger.error(f"Twilio health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )

# WebSocket endpoint
@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    shared_state = get_shared_state(websocket.app)
    await shared_state.websocket_manager.connect(websocket, session_id)
    logger.info(f"WebSocket connected for session {session_id}")
    
    try:
        await websocket.send_text(json.dumps({
            "type": "connected",
            "data": {
                "message": "Connected to scalable call center backend",
                "session_id": session_id,
                "instance_id": settings.INSTANCE_ID
            }
        }))
        
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                logger.debug(f"Received WebSocket message for session {session_id}: {message}")
                await handle_websocket_message(shared_state, session_id, message)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON message from session {session_id}: {e}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "data": {"message": "Invalid message format"}
                }))
            
    except WebSocketDisconnect as e:
        logger.info(f"WebSocket disconnected for session {session_id}: code={e.code}, reason={e.reason}")
        await shared_state.websocket_manager.disconnect(session_id)
        # Update agent status to offline
        agent_session = await shared_state.redis_manager.get_agent_session(session_id)

        if agent_session:
            agent_id = agent_session.get("agent_id")
            await shared_state.redis_manager.update_agent_status(agent_id, "offline")
            await shared_state.db_manager.db.agents.update_one(
                {"userId": ObjectId(agent_id)},
                {"$set": {"status": "offline", "last_activity": datetime.now(timezone.utc)}}
            )
            logger.info(f"Agent {agent_id} set to offline status")
    except Exception as e:
        logger.error(f"WebSocket error for session {session_id}: {str(e)}")
        await websocket.send_text(json.dumps({
            "type": "error",
            "data": {"message": f"Server error: {str(e)}"}
        }))
        await shared_state.websocket_manager.disconnect(session_id)
        agent_session = await shared_state.redis_manager.get_agent_session(session_id)
        if agent_session:
            agent_id = agent_session.get("agent_id")
            await shared_state.redis_manager.update_agent_status(agent_id, "offline")
            await shared_state.db_manager.db.agents.update_one(
                {"userId": ObjectId(agent_id)},
                {"$set": {"status": "offline", "last_activity": datetime.now(timezone.utc)}}
            )
            logger.info(f"Agent {agent_id} set to offline status due to error")

@router.post("/admin/test-twilio-connection")
async def test_twilio_connection(request: Request, current_agent: dict = Depends(get_current_agent)):
    """Test connection to Twilio and webhook configuration"""
    shared_state = get_shared_state(request.app)
    
    try:
        # Test Twilio API connection
        account = shared_state.twilio_client.api.accounts(settings.TWILIO_ACCOUNT_SID).fetch()
        
        # Get phone numbers and their webhook configurations
        phone_numbers = shared_state.twilio_client.incoming_phone_numbers.list()
        
        webhook_status = []
        for number in phone_numbers:
            webhook_status.append({
                "phone_number": number.phone_number,
                "webhook_url": number.voice_url,
                "webhook_method": number.voice_method,
                "status": "configured" if number.voice_url else "not_configured"
            })
        
        # Test webhook reachability
        webhook_reachable = False
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{settings.BASE_URL}/health/simple", timeout=10)
                webhook_reachable = response.status_code == 200
        except:
            webhook_reachable = False
        
        return {
            "twilio_api_connected": True,
            "account_status": account.status,
            "webhook_reachable": webhook_reachable,
            "phone_numbers": webhook_status,
            "backend_health": shared_state.health_status.backend_healthy,
            "last_successful_call": await shared_state.redis_manager.redis_client.get("last_successful_call")
        }
        
    except Exception as e:
        logger.error(f"Twilio connection test failed: {e}")
        return {
            "twilio_api_connected": False,
            "error": str(e),
            "webhook_reachable": False,
            "backend_health": shared_state.health_status.backend_healthy
        }

@router.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(content=get_metrics(), media_type="text/plain")

@router.get("/twilio/token")
async def generate_twilio_token(current_agent: dict = Depends(get_current_agent)):
    """Generate Twilio access token"""
    try:
        sip_username = current_agent["sip_username"]
        agent_id = current_agent["agent_id"]

        token = AccessToken(
            settings.TWILIO_ACCOUNT_SID,
            settings.TWILIO_API_KEY,
            settings.TWILIO_API_SECRET,
            identity=sip_username,
            ttl=3600
        )
        
        voice_grant = VoiceGrant(
            outgoing_application_sid=settings.TWILIO_APP_SID,
            incoming_allow=True
        )
        token.add_grant(voice_grant)

        logger.info(f"Generated Twilio token for agent {agent_id}")
        return {
            "token": token.to_jwt(),
            "agent_id": agent_id,
            "sip_username": sip_username,
            "identity": sip_username,
            "audio_constraints": {
                "echoCancellation": True,
                "noiseSuppression": True,
                "autoGainControl": True
            }
        }
    except Exception as e:
        logger.error(f"Failed to generate Twilio token: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate token")

@router.post("/refresh-token")
async def refresh_token(request: TokenRefreshRequest):
    """Refresh JWT access token"""
    try:
        refresh_token = request.refresh_token
        if not refresh_token:
            raise HTTPException(status_code=400, detail="Refresh token required")
        
        payload = jwt.decode(
            refresh_token, 
            settings.JWT_REFRESH_SECRET, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        access_token = jwt.encode(
            {
                "id": payload["id"],
                "email": payload["email"],
                "name": payload.get("name", ""),
                "role": payload.get("role", ""),
                "isVerified": payload.get("isVerified", False),
                "sip": payload.get("sip", {})
            },
            settings.JWT_ACCESS_SECRET,
            algorithm=settings.JWT_ALGORITHM
        )
        
        return {"access_token": access_token}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@router.get("/user-info")
async def get_user_info(request: Request, current_agent: dict = Depends(get_current_agent)):
    """Get current user information"""
    shared_state = get_shared_state(request.app)
    
    try:
        agent = await shared_state.db_manager.db.agents.find_one({"userId": ObjectId(current_agent["agent_id"])})
        organization_id = str(agent.get("assignTo")) if agent and agent.get("assignTo") else None
        
        return {
            "success": True,
            "data": {
                "id": current_agent["agent_id"],
                "email": current_agent["email"],
                "name": current_agent.get("name", ""),
                "role": current_agent.get("role", ""),
                "isVerified": current_agent.get("is_verified", False),
                "sip": {
                    "sip_username": current_agent["sip_username"],
                    "sip_password": current_agent["sip_password"],
                    "sip_address": current_agent["sip_address"]
                },
                "organization_id": organization_id,
                "instance_id": settings.INSTANCE_ID
            }
        }
    except Exception as e:
        logger.error(f"Failed to get user info: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user information")

@router.put("/agent/status")
async def update_agent_status(
    request: Request,
    status_update: AgentStatusUpdate, 
    current_agent: dict = Depends(get_current_agent)
):
    """Update agent status with Redis sync"""
    shared_state = get_shared_state(request.app)
    
    try:
        agent_id = current_agent["agent_id"]
        new_status = status_update.status

        # Update Redis
        await shared_state.redis_manager.update_agent_status(agent_id, new_status)
        
        # Update database
        await shared_state.db_manager.db.agents.update_one(
            {"userId": ObjectId(agent_id)},
            {"$set": {"status": new_status, "last_activity": datetime.now(timezone.utc)}}
        )

        logger.info(f"Agent {agent_id} status updated to: {new_status}")

        return {
            "message": "Status updated successfully",
            "agent_id": agent_id,
            "new_status": new_status,
            "instance_id": settings.INSTANCE_ID
        }
        
    except Exception as e:
        logger.error(f"Status update error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update status")
    

# -------------------------------------------------------------------------
#  INBOUND CALL
# -------------------------------------------------------------------------
@router.post("/twilio/inbound-call")
async def handle_incoming_call(request: Request):
    """
    Handle incoming Twilio calls with connection validation
    Only the data-storage logic is changed: we insert into Call model.
    """
    shared_state = get_shared_state(request.app)
    form_data = await request.form()
    CallSid = form_data.get("CallSid")
    From = form_data.get("From")
    To = form_data.get("To")

    logger.info(f"Incoming call: {From} -> {To} (CallSid: {CallSid})")

    # Backend health check
    if not shared_state.health_status.backend_healthy:
        logger.error(f"Call {CallSid} received but backend is unhealthy")
        response = VoiceResponse()
        response.say(
            "We are experiencing technical difficulties. Please try again in a few moments.",
            voice="alice",
            language="en-US"
        )
        response.hangup()
        CALLS_TOTAL.labels(status="backend_unhealthy").inc()
        return Response(content=str(response), media_type="application/xml")

    CALLS_TOTAL.labels(status="incoming").inc()
    response = VoiceResponse()

    try:
        # Update last successful call timestamp
        await shared_state.redis_manager.redis_client.setex(
            "last_successful_call", 3600, datetime.now(timezone.utc).isoformat()
        )

        # Determine org & agent
        organization_id = await determine_organization_from_call(
            shared_state.db_manager,
            shared_state.redis_manager,
            To
        )
        agent_id = await find_best_available_agent(
            shared_state.redis_manager,
            organization_id
        )

        # ---- INSERT INITIAL CALL RECORD (your Call model) ----
        call_doc = await Call(
            call_sid=CallSid,
            organizationId=ObjectId(organization_id) if organization_id else None,
            agentId=ObjectId(agent_id) if agent_id else None,
            from_number=From,
            to_number=To,
            callType=CallType.INCOMING,
            call_status=CallStatus.INITIATED,
            call_time=datetime.now(timezone.utc),
            call_started_at=datetime.now(timezone.utc) if agent_id else None,
        ).insert()
        logger.info(f"Inserted data scussfully like this forma: {call_doc}")

        if agent_id:
            call_data = {
                "call_id": CallSid,
                "caller_number": From,
                "called_number": To,
                "agent_id": agent_id,
                "status": "routing",
                "organization_id": organization_id or "",
                "instance_id": settings.INSTANCE_ID,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            await shared_state.redis_manager.set_active_call(CallSid, call_data)

            await shared_state.redis_manager.update_agent_status(agent_id, "busy")
            await shared_state.db_manager.db.agents.update_one(
                {"userId": ObjectId(agent_id)},
                {"$set": {"status": "busy", "last_activity": datetime.now(timezone.utc)}}
            )

            agent_session = await shared_state.redis_manager.get_agent_session(agent_id)
            if not agent_session:
                raise Exception(f"Agent session not found for {agent_id}")

            await shared_state.websocket_manager.send_to_agent(agent_id, {
                "type": "incoming_call",
                "data": {
                    "call_id": CallSid,
                    "caller_number": From,
                    "called_number": To,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "organization_id": organization_id
                }
            })

            response.say(
                "Thank you for calling. Please wait while we connect you to an agent.",
                voice="alice",
                language="en-US"
            )
            response.pause(length=1)

            dial = response.dial(
                caller_id=From,
                timeout=30,
                action=f"/twilio/call-status?call_id={CallSid}&agent_id={agent_id}",
                method="POST",
                record="record-from-answer",
                recording_status_callback="/twilio/recording-status"
            )

            dial.client(
                agent_session["sip_username"],
                status_callback_event="initiated ringing answered completed",
                status_callback="/twilio/client-status",
                status_callback_method="POST"
            )

            ACTIVE_CALLS.inc()
            logger.info(f"Call {CallSid} routed to agent {agent_id}")

        else:
            response.say(
                "All our agents are currently busy. Please try again later. Goodbye.",
                voice="alice",
                language="en-US"
            )
            response.hangup()
            CALLS_TOTAL.labels(status="no_agent").inc()
            logger.warning(f"No agents available for call {CallSid}")

    except Exception as e:
        logger.error(f"Error handling incoming call {CallSid}: {e}")
        response.say(
            "We're experiencing technical difficulties. Please try again later.",
            voice="alice",
            language="en-US"
        )
        response.hangup()
        CALLS_TOTAL.labels(status="error").inc()

    return Response(content=str(response), media_type="application/xml")


# -------------------------------------------------------------------------
#  CALL STATUS UPDATES
# -------------------------------------------------------------------------
@router.post("/twilio/call-status")
async def handle_call_status(request: Request):
    """
    Handle Twilio call status updates.
    Reads `call_id` (or `CallSid`), `agent_id`, and `DialCallStatus` (or CallStatus) from form data.
    Updates Call model, agent metrics, Redis status, and notifies via WebSocket.
    """
    shared_state = get_shared_state(request.app)
    form_data = await request.form()

    print(form_data)

    # Twilio sends CallSid instead of call_id
    call_id = form_data.get("call_id") or form_data.get("CallSid")

    print("Call SID: ",call_id)
    
    # Sometimes DialCallStatus is missing; fallback to CallStatus
    DialCallStatus = form_data.get("DialCallStatus") or form_data.get("CallStatus")

    if not call_id:
        logger.error(f"Missing call_id in call-status POST: {dict(form_data)}")
        CALLS_TOTAL.labels(status="error").inc()
        return {"status": "error", "message": "Missing call_id"}
    
    # Fetch call document from DB
    call = await Call.find_one(Call.call_sid == call_id)
    if not call:
        logger.error(f"Call record not found for {call_id}")
        CALLS_TOTAL.labels(status="error").inc()
        return {"status": "error", "message": "Call record not found"}
    
    # --- Add this check here ---
    if call.call_status in {CallStatus.COMPLETED, CallStatus.BUSY}:
        logger.info(f"Call {call_id} already ended: {call.call_status}")
        return {"status": "ok", "message": "Already processed"}

    agent_id = str(call.agentId)
    if not agent_id:
        logger.error(f"Missing agent_id for call {call_id}")
        CALLS_TOTAL.labels(status="error").inc()
        return {"status": "error", "message": "Missing agent_id"}

    # Validate DialCallStatus
    if DialCallStatus not in {"completed", "busy", "no-answer", "failed", "canceled"}:
        logger.warning(f"Invalid or missing DialCallStatus for call {call_id}: {DialCallStatus}")
        DialCallStatus = "completed"  # fallback to 'completed'

    logger.info(f"Call status update: {DialCallStatus} for call {call_id}")

    try:
        # 1️⃣ Get call data from Redis
        call_data = await shared_state.redis_manager.get_active_call(call_id)

        # 2️⃣ Calculate call duration safely (always use UTC-aware datetimes)
        end_time = datetime.now(timezone.utc)

        start_time = None
        if call.call_started_at:
            start_time = call.call_started_at
            # Ensure DB datetime is timezone-aware
            if start_time.tzinfo is None:
                start_time = start_time.replace(tzinfo=timezone.utc)
        elif call_data and call_data.get("timestamp"):
            start_time = datetime.fromisoformat(call_data.get("timestamp").replace("Z", "+00:00"))

        call_duration = int((end_time - start_time).total_seconds()) if start_time else None

        # 3️⃣ Update Call document in DB
        await call.update({
            "$set": {
                "call_status": CallStatus[DialCallStatus.upper()],
                "call_completed_at": end_time,
                "call_duration": call_duration,
                "updatedAt": end_time
            }
        })

        # 4️⃣ Remove from active calls in Redis
        await shared_state.redis_manager.remove_active_call(call_id)

        # 5️⃣ Update agent status + metrics in DB
        update_query = {"$set": {"status": "free", "last_activity": end_time}}
        if DialCallStatus == "completed":
            update_query["$inc"] = {"successCalls": 1}
            CALLS_TOTAL.labels(status="completed").inc()
        else:
            update_query["$inc"] = {"droppedCalls": 1}
            CALLS_TOTAL.labels(status="dropped").inc()

        await shared_state.db_manager.db.agents.update_one(
            {"userId": ObjectId(agent_id)},
            update_query
        )

        # 6️⃣ Update Redis agent status
        await shared_state.redis_manager.update_agent_status(agent_id, "free")

        # 7️⃣ Notify agent via WebSocket (no timeout argument)
        await shared_state.websocket_manager.send_to_agent(
            agent_id,
            {
                "type": "call_ended",
                "data": {
                    "call_id": call_id,
                    "status": DialCallStatus,
                    "timestamp": end_time.isoformat()
                }
            }
        )

        # 8️⃣ Update active calls metric safely
        try:
            if ACTIVE_CALLS._value.get() > 0:  # use .get() for MutexValue
                ACTIVE_CALLS.dec()
        except Exception as metric_error:
            logger.warning(f"Failed to decrement ACTIVE_CALLS metric: {metric_error}")

        logger.info(f"Call {call_id} ended successfully: {DialCallStatus}")

        return {"status": "ok", "call_id": call_id, "agent_id": agent_id, "call_status": DialCallStatus}

    except Exception as e:
        logger.error(f"Error handling call status for {call_id}: {str(e)}")

        # Ensure agent status is always reset to 'free'
        try:
            await shared_state.redis_manager.update_agent_status(agent_id, "free")
            await shared_state.db_manager.db.agents.update_one(
                {"userId": ObjectId(agent_id)},
                {"$set": {"status": "free", "last_activity": datetime.now(timezone.utc)}}
            )
        except Exception as inner:
            logger.error(f"Failed to update agent status during exception handling: {str(inner)}")

        CALLS_TOTAL.labels(status="error").inc()
        return {"status": "error", "message": str(e)}
# -------------------------------------------------------------------------
#  CLIENT STATUS
# -------------------------------------------------------------------------
@router.post("/twilio/client-status")
async def handle_client_status(request: Request):
    shared_state = get_shared_state(request.app)
    form_data = await request.form()
    CallSid = form_data.get("CallSid")
    CallStatus = form_data.get("CallStatus")
    Called = form_data.get("Called")

    logger.info(f"Client status: {CallStatus} for call {CallSid}, client: {Called}")

    if CallStatus == "in-progress":
        pattern = "call:*"
        async for key in shared_state.redis_manager.redis_client.scan_iter(match=pattern):
            call_data = await shared_state.redis_manager.redis_client.hgetall(key)
            if call_data.get("status") != "ended":
                call_data["status"] = "connected"
                await shared_state.redis_manager.redis_client.hset(key, mapping=call_data)
                logger.info(f"Call {key.split(':')[1]} is now connected")
                break
    return {"status": "ok"}


# -------------------------------------------------------------------------
#  RECORDING STATUS  -> stores URL + duration and optional transcription
# -------------------------------------------------------------------------
@router.post("/twilio/recording-status")
async def handle_recording_status(
    request: Request,
    background_tasks: BackgroundTasks
):
    form_data = await request.form()

    CallSid = form_data.get("CallSid")
    RecordingStatus = form_data.get("RecordingStatus")
    RecordingUrl = form_data.get("RecordingUrl")
    RecordingSid = form_data.get("RecordingSid")
    RecordingDuration = form_data.get("RecordingDuration")
    TranscriptionText = form_data.get("TranscriptionText")

    # ✅ Log safely
    logger.info(f"Recording callback received: {dict(form_data)}")

    # ✅ Save recording info immediately
    await Call.find_one(Call.call_sid == CallSid).update(
        {
            "$set": {
                "recording_url": RecordingUrl,
                "recording_sid": RecordingSid,
                "recording_duration": int(RecordingDuration) if RecordingDuration else None,
                "recording_status": RecordingStatus,
                "call_transcript": TranscriptionText if TranscriptionText else None
            }
        }
    )

    # ✅ Start async transcription if recording completed
    if RecordingStatus == "completed" and RecordingUrl:
        audio_url = f"{RecordingUrl}.mp3"
        background_tasks.add_task(transcribe_and_store, CallSid, audio_url)
        # background_tasks.add_task(call_lead_generation_api, CallSid)

    return {"status": "ok"}


async def transcribe_and_store(call_sid: str, audio_url: str):
    async with httpx.AsyncClient(
        auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    ) as client:
        audio_resp = await client.get(audio_url)
        audio_resp.raise_for_status()
        audio_bytes = audio_resp.content

    transcript_resp = openai_client.audio.transcriptions.create(
        model="whisper-1",
        file=("call.mp3", audio_bytes)
    )
    transcript_text = transcript_resp.text

    await Call.find_one(Call.call_sid == call_sid).update(
        {"$set": {"call_transcript": transcript_text}}
    )

async def call_lead_generation_api(call_sid: str):
    """
    Send HTTP POST request to lead generation API.
    Args:
        call_sid: Twilio CallSid to include as query parameter.
    """
    lead_url = settings.LEAD_GENERATION_API_URL
    lead_generation_url = f"{lead_url}/organizations/conversations/"

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.post(
                lead_generation_url,
                params={"call_sid": call_sid},
                json={}  # Empty body to match cURL example
            )
            response.raise_for_status()
            logger.info(f"Lead generation API called successfully for call_sid: {call_sid}")
        except httpx.HTTPStatusError as e:
            error_detail = e.response.json() if e.response.content else str(e)
            logger.error(f"Lead generation API failed for call_sid: {call_sid}, status: {e.response.status_code}, detail: {error_detail}")
            # Don't raise exception in background task; log instead
        except httpx.RequestError as e:
            logger.error(f"Network error calling lead generation API for call_sid: {call_sid}: {str(e)}")




# -------------------------------------------------------------------------
#  OPTIONAL SEPARATE TRANSCRIPTION CALLBACK
#  (Only needed if you use transcribe_callback instead of embedding in recording)
# -------------------------------------------------------------------------
@router.post("/twilio/transcription-status")
async def handle_transcription_status(request: Request):
    form_data = await request.form()
    CallSid = form_data.get("CallSid")
    transcript = form_data.get("TranscriptionText")

    if transcript:
        await Call.find_one(Call.call_sid == CallSid).update(
            {"$set": {"call_transcript": transcript}}
        )
    return {"status": "ok"}

# Admin endpoints for monitoring
@router.get("/admin/agents")
async def list_agents(request: Request, current_agent: dict = Depends(get_current_agent)):
    """List all active agents (admin only)"""
    shared_state = get_shared_state(request.app)
    
    try:
        agents = []
        pattern = "agent:*"
        async for key in shared_state.redis_manager.redis_client.scan_iter(match=pattern):
            agent_data = await shared_state.redis_manager.redis_client.hgetall(key)
            if agent_data:
                agent_data["agent_id"] = key.split(":")[1]
                agents.append(agent_data)
        
        return {"agents": agents, "total": len(agents)}
        
    except Exception as e:
        logger.error(f"Failed to list agents: {e}")
        raise HTTPException(status_code=500, detail="Failed to list agents")

@router.get("/admin/calls")
async def list_active_calls(request: Request, current_agent: dict = Depends(get_current_agent)):
    """List all active calls (admin only)"""
    shared_state = get_shared_state(request.app)
    
    try:
        calls = []
        pattern = "call:*"
        async for key in shared_state.redis_manager.redis_client.scan_iter(match=pattern):
            call_data = await shared_state.redis_manager.redis_client.hgetall(key)
            if call_data:
                call_data["call_id"] = key.split(":")[1]
                calls.append(call_data)
        
        return {"calls": calls, "total": len(calls)}
        
    except Exception as e:
        logger.error(f"Failed to list calls: {e}")
        raise HTTPException(status_code=500, detail="Failed to list calls")
    

#--------------------------------------------------------
#Working outbound
#-------------------------------------------------------
# @router.post("/voice")
# @router.get("/voice")
# async def voice_twiml(request: Request):
#     """
#     Handle direct outbound calls from Twilio Client.
#     Returns TwiML <Dial> with dynamic caller ID based on agent's organization.
#     """

#     shared_state = get_shared_state(request.app)
#     logger = getattr(shared_state, 'logger', None)

#     try:
#         # Parse request parameters
#         if request.method == "POST":
#             form = await request.form()
#             to = form.get("To")
#             from_ = form.get("From")
#         else:
#             to = request.query_params.get("To")
#             from_ = request.query_params.get("From")

#         agent_name = from_.replace('client:', '') if from_ and 'client:' in from_ else from_
#         print("Agent Name: ",agent_name)

#         if logger:
#             logger.info(f"[Voice] Received call request: From={from_}, To={to}")

#         # Input validation
#         if not to or not from_:
#             return _twiml_error("Missing 'To' or 'From' parameter", logger)

#         if not agent_name:
#             return _twiml_error("Invalid agent name in 'From' parameter", logger)

#         # Fetch agent from DB
#         agent = await shared_state.db_manager.db.agents.find_one({"sip_username": agent_name})
#         print("Agent Information", agent)
#         if not agent:
#             return _twiml_error(f"Agent '{agent_name}' not found", logger)

#         # Fetch organization info
#         assign_to = agent.get("assignTo")
#         print("Agent Assign to: ", assign_to)
#         if not assign_to:
#             return _twiml_error(f"No organization assigned to agent '{agent_name}'", logger)

#         organization = await shared_state.db_manager.db.organizations.find_one({"_id": ObjectId(assign_to)})
#         print("Organization Info: ", organization)
#         if not organization:
#             return _twiml_error(f"Organization not found for agent '{agent_name}'", logger)

#         VALID_CALLER_ID = organization.get("organizationNumber")
#         if not VALID_CALLER_ID:
#             return _twiml_error(f"Organization caller ID missing for agent '{agent_name}'", logger)

#         # Clean and format destination number
#         cleaned_to = re.sub(r"[^\d]", "", to)
#         formatted_to = _format_number(cleaned_to)

#         if logger:
#             logger.info(f"[Voice] Calling {formatted_to} from {VALID_CALLER_ID}")

#         # Generate TwiML
#         response = VoiceResponse()
#         dial = Dial(callerId=VALID_CALLER_ID, timeout=30)
#         dial.number(formatted_to)
#         response.append(dial)

#         print("Dial Info: ", dial)

#         return Response(content=str(response), media_type="application/xml")

#     except Exception as e:
#         error_msg = f"Internal error in /voice: {str(e)}"
#         if logger:
#             logger.error(error_msg)
#         return _twiml_error("An unexpected error occurred while placing the call", logger)


# -------------------------------------------------------------------------
#  OUTBOUND CALL - /voice
# -------------------------------------------------------------------------
@router.post("/voice")
@router.get("/voice")
async def voice_twiml(request: Request):
    """
    Handle direct outbound calls from Twilio Client.
    Returns TwiML <Dial> with dynamic caller ID based on agent's organization.
    """

    shared_state = get_shared_state(request.app)
    logger = getattr(shared_state, 'logger', None)

    try:
        # Parse request parameters
        if request.method == "POST":
            form = await request.form()
            to = form.get("To")
            from_ = form.get("From")
        else:
            to = request.query_params.get("To")
            from_ = request.query_params.get("From")

        agent_name = from_.replace('client:', '') if from_ and 'client:' in from_ else from_
        print("Agent Name: ",agent_name)

        if logger:
            logger.info(f"[Voice] Received call request: From={from_}, To={to}")

        # Input validation
        if not to or not from_:
            return _twiml_error("Missing 'To' or 'From' parameter", logger)

        if not agent_name:
            return _twiml_error("Invalid agent name in 'From' parameter", logger)

        # Fetch agent from DB
        agent = await shared_state.db_manager.db.agents.find_one({"sip_username": agent_name})
        print("Agent Information", agent)
        if not agent:
            return _twiml_error(f"Agent '{agent_name}' not found", logger)

        # Fetch organization info
        assign_to = agent.get("assignTo")
        print("Agent Assign to: ", assign_to)
        if not assign_to:
            return _twiml_error(f"No organization assigned to agent '{agent_name}'", logger)

        organization = await shared_state.db_manager.db.organizations.find_one({"_id": ObjectId(assign_to)})
        print("Organization Info: ", organization)
        if not organization:
            return _twiml_error(f"Organization not found for agent '{agent_name}'", logger)

        VALID_CALLER_ID = organization.get("organizationNumber")
        if not VALID_CALLER_ID:
            return _twiml_error(f"Organization caller ID missing for agent '{agent_name}'", logger)

        # Clean and format destination number
        cleaned_to = re.sub(r"[^\d]", "", to)
        formatted_to = _format_number(cleaned_to)

        if logger:
            logger.info(f"[Voice] Calling {formatted_to} from {VALID_CALLER_ID}")

        

        # Generate TwiML
        response = VoiceResponse()
        dial = Dial(callerId=VALID_CALLER_ID, timeout=30)
        dial.number(formatted_to)
        response.append(dial)

        

        return Response(content=str(response), media_type="application/xml")
    
    

    except Exception as e:
        error_msg = f"Internal error in /voice: {str(e)}"
        if logger:
            logger.error(error_msg)
        return _twiml_error("An unexpected error occurred while placing the call", logger)


    


# # ----------------- Twilio Status Callback -----------------
# @router.post("/twilio/outbound-call-status")
# async def outbound_call_status(request: Request):
#     """
#     Handle Twilio status callbacks and update the corresponding call record.
#     """
#     shared_state = get_shared_state(request.app)
#     logger = getattr(shared_state, "logger", None)
#     form = await request.form()

#     call_sid = form.get("CallSid")
#     call_status_str = form.get("CallStatus")
#     from_number = form.get("From")
#     to_number = form.get("To")
#     direction = form.get("Direction")

#     # Map status string to CallStatus enum
#     call_status = CallStatus(call_status_str) if call_status_str in CallStatus._value2member_map_ else CallStatus.FAILED

#     # Determine call type
#     call_type = CallType.OUTGOING if direction and "outbound" in direction else CallType.INCOMING

#     try:
#         # ----------------- Find existing call record -----------------
#         existing_call = await Call.find_one(
#             (Call.from_number == from_number) &
#             (Call.to_number == to_number) &
#             (Call.call_status.in_([CallStatus.INITIATED, CallStatus.IN_PROGRESS]))
#         )

#         if existing_call:
#             existing_call.call_sid = call_sid
#             existing_call.call_status = call_status

#             if call_status == CallStatus.IN_PROGRESS:
#                 existing_call.call_started_at = datetime.now(timezone.utc)
#             elif call_status in {CallStatus.COMPLETED, CallStatus.BUSY, CallStatus.FAILED, CallStatus.NO_ANSWER, CallStatus.CANCELED}:
#                 existing_call.call_completed_at = datetime.now(timezone.utc)
#                 if existing_call.call_started_at:
#                     existing_call.call_duration = int(
#                         (existing_call.call_completed_at - existing_call.call_started_at).total_seconds()
#                     )

#             await existing_call.save()

#             agent_info = await shared_state.db_manager.db.agents.find_one({"_id": existing_call.agentId})
#         else:
#             # If no record found, create a new one
#             existing_call = Call(
#                 call_sid=call_sid,
#                 from_number=from_number,
#                 to_number=to_number,
#                 callType=call_type,
#                 call_status=call_status,
#                 call_time=datetime.now(timezone.utc),
#             )
#             await existing_call.insert()
#             agent_info = None

#         # ----------------- Logging -----------------
#         if logger:
#             logger.info(
#                 f"CallSid={call_sid}, Status={call_status}, From={from_number}, To={to_number}, "
#                 f"Agent={agent_info.get('sip_username') if agent_info else 'Unknown'}"
#             )

#     except Exception as e:
#         if logger:
#             logger.error(f"Error in /twilio/outbound-call-status: {e}")

#     return {"status": "ok"}


# # ----------------- Helpers -----------------
def _twiml_error(message: str, logger=None):
    if logger:
        logger.error(f"[Voice] Error: {message}")
    resp = VoiceResponse()
    resp.say(message)
    return Response(content=str(resp), media_type="application/xml")


def _format_number(number: str) -> str:
    """
    Format phone number for dialing (Bangladesh default +880 if missing).
    """
    if number.startswith("880") and len(number) == 11:
        return f"+{number}"
    elif len(number) == 10 and not number.startswith("880"):
        return f"+880{number}"
    elif number.startswith("+"):
        return number
    else:
        return f"+{number}"