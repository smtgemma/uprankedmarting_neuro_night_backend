from fastapi import APIRouter, Request, HTTPException
import httpx
import hmac
import hashlib
import time
from bson import ObjectId
from fastapi.responses import JSONResponse, StreamingResponse
import os
import json
import requests
import io

from app.core.config import settings
from app.api.models.ai_agent_model import AICallLog, CallStatus, CallType
from datetime import datetime, timezone, timedelta
from app.services.shared_state import get_shared_state

router = APIRouter(prefix="/webhook", tags=["Eleven labs web hooks"])

# Load the shared secret from environment variable or config
ELEVENLABS_WEBHOOK_SECRET = settings.ELEVENLABS_WEBHOOK
ELEVENLABS_API_KEY = settings.ELEVENLABS_API_KEY  # You must have this
ELEVENLABS_BASE_URL = "https://api.elevenlabs.io"

# Tolerance in seconds for how old timestamp can be (to prevent replay)
TIMESTAMP_TOLERANCE = 30 * 60  # e.g. 30 minutes



# -------------------------------------------------
# 1️⃣ INITIATION WEBHOOK – store initial call info
# -------------------------------------------------
@router.post("/initiation-webhook")
async def initiation_webhook(request: Request):
    """
    Called at call start. Creates a record in MongoDB with temp_id.
    """
    body = await request.json()
    print("initialize webhook data", body)

    caller_id = body.get("caller_id", "")
    agent_id = body.get("agent_id", "")
    called_number = body.get("called_number", "")
    call_sid = body.get("call_sid", "")  # may be empty at initiation

    # Generate a temporary ID for this record (use ObjectId)
    temp_id = str(ObjectId())

    # Insert initial record in DB
    call_doc = AICallLog(
        _id=ObjectId(temp_id),
        call_sid=call_sid,  # may be empty initially
        agent_id=agent_id,
        from_number=caller_id,
        to_number=called_number,
        callType=CallType.INCOMING,  # default; can be adjusted
        call_status=CallStatus.INITIATED,
        call_time=datetime.now(timezone.utc),
        call_started_at=datetime.now(timezone.utc),
    )
    await call_doc.insert()
    print("Initial call record inserted:", call_doc.id)

    # Return dynamic variables for ElevenLabs
    dynamic_variables = {
        "temp_id": temp_id,
        "from_number": caller_id,
        "to_number": called_number,
        "call_sid": call_sid,
        "agent_id": agent_id,
    }

    return JSONResponse(
        {
            "type": "conversation_initiation_client_data",
            "dynamic_variables": dynamic_variables,
        }
    )


# -------------------------------------------------
# 2️⃣ POST–CALL WEBHOOK – update record
# -------------------------------------------------
@router.post("/elevenlabs-call-log")
async def handle_post_call_transcription(request: Request):
    """
    Post–call webhook from ElevenLabs.
    1. Verify signature
    2. Fetch conversation details
    3. Update our AICallLog using either temp_id (preferred) or twilio_sid
    """
    raw_body = await request.body()
    shared_state = get_shared_state(request.app)

    # ---------- 1. Verify signature ----------
    sig_header = request.headers.get("ElevenLabs-Signature") \
                 or request.headers.get("elevenlabs-signature")
    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing signature header")

    try:
        parts = dict(item.split("=", 1) for item in sig_header.split(","))
        timestamp_str = parts["t"]
        signature_provided = parts["v0"]
        timestamp = int(timestamp_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature header")

    if abs(int(time.time()) - timestamp) > TIMESTAMP_TOLERANCE:
        raise HTTPException(status_code=400, detail="Timestamp too old")

    expected = hmac.new(
        ELEVENLABS_WEBHOOK_SECRET.encode(),
        f"{timestamp_str}.{raw_body.decode()}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature_provided, expected):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # ---------- 2. Parse ElevenLabs payload ----------
    body = json.loads(raw_body)
    data = body.get("data", {})
    conversation_id = data.get("conversation_id")
    if not conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id missing")

    # Fetch full conversation
    convo_url = f"{ELEVENLABS_BASE_URL}/v1/convai/conversations/{conversation_id}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(convo_url, headers={
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
        })
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch conversation")
    convo = resp.json()

    # ---------- 3. Extract fields ----------
    client_data = convo.get("conversation_initiation_client_data", {}) or {}
    dynamic_vars = client_data.get("dynamic_variables", {}) or {}

    temp_id       = dynamic_vars.get("temp_id")
    twilio_sid    = dynamic_vars.get("call_sid") or dynamic_vars.get("system__call_sid") or ""
    conversation_id = dynamic_vars.get("system__conversation_id") or conversation_id
    agent_id      = dynamic_vars.get("agent_id") or dynamic_vars.get("system__agent_id")
    from_number   = dynamic_vars.get("from_number") or dynamic_vars.get("system__caller_id") or ""
    to_number     = dynamic_vars.get("to_number") or dynamic_vars.get("system__called_number") or ""
    status_full   = convo.get("status") or data.get("status")
    transcript    = "\n".join(
        f"{t.get('role')}: {t.get('message')}" for t in convo.get("transcript", [])
    )

    start_unix    = convo.get("metadata", {}).get("start_time_unix_secs")
    duration_sec  = convo.get("metadata", {}).get("call_duration_secs")
    started_at    = datetime.fromtimestamp(start_unix, timezone.utc) if start_unix else None
    completed_at  = (datetime.fromtimestamp(start_unix + duration_sec, timezone.utc)
                     if start_unix and duration_sec else None)
    

    #---------- Find organization ----------
    # Assuming `shared_state.db_manager.db.organizations` is your MongoDB collection
    organization = await shared_state.db_manager.db.organizations.find_one(
        {"organizationNumber": to_number},
        {"_id": 1}  # Include only the _id field
    )

    # Extract the _id value
    organization_id = organization["_id"] if organization else None

    # ---------- 4. Find call record ----------
    call_log = None
    if temp_id:  # preferred lookup
        call_log = await AICallLog.find_one({"_id": ObjectId(temp_id)})
    if not call_log and twilio_sid:
        call_log = await AICallLog.find_one({"call_sid": twilio_sid})

    if not call_log:
        raise HTTPException(
            status_code=404,
            detail="No matching call log found using temp_id or call_sid"
        )

    # ---------- 5. Update ----------
    try:
        call_status = CallStatus(status_full)
    except Exception:
        call_status = CallStatus.COMPLETED

    await call_log.set({
        AICallLog.organizationId: organization_id,
        AICallLog.agent_id:           agent_id,
        AICallLog.conversation_id:    conversation_id,
        AICallLog.from_number:       from_number or call_log.from_number,
        AICallLog.to_number:         to_number   or call_log.to_number,
        AICallLog.call_status:       call_status,
        AICallLog.call_started_at:   started_at or call_log.call_started_at,
        AICallLog.call_completed_at: completed_at,
        AICallLog.call_duration:     duration_sec,
        AICallLog.recording_duration: duration_sec,
        AICallLog.call_transcript:   transcript,
        AICallLog.call_sid:          twilio_sid or call_log.call_sid,
    })

    print("✅ ElevenLabs post-call update:", call_log.id)
    return {
        "status": "updated",
        "conversation_id": conversation_id,
        "call_sid": twilio_sid,
        "temp_id": temp_id,
    }


@router.get("/elevenlabs/conversation/{conversation_id}/audio")
def get_conversation_audio(conversation_id: str):
    url = f"https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}/audio"
    headers = {"xi-api-key": ELEVENLABS_API_KEY}

    response = requests.get(url, headers=headers, stream=True)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch conversation audio")

    audio_bytes = io.BytesIO(response.content)
    return StreamingResponse(audio_bytes, media_type="audio/mpeg", headers={
        "Content-Disposition": f"attachment; filename={conversation_id}.mp3"
    })



























# from fastapi import APIRouter, HTTPException, Depends, Request
# from app.api.models.ai_agent_model import AIAgent, AICallLog, AICallWebhookPayload
# from datetime import datetime
# from typing import Optional
# import logging

# # Configure logging
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)
# router = APIRouter(prefix="/webhook", tags=["Eleven labs web hooks"])


# class ElevenLabsWebhookService:
#     """Service class to handle ElevenLabs webhook processing"""
    
#     @staticmethod
#     def calculate_call_duration(start_time: str, end_time: str) -> Optional[int]:
#         """Calculate call duration in seconds from ISO timestamps"""
#         try:
#             start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
#             end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
#             return int((end_dt - start_dt).total_seconds())
#         except Exception as e:
#             logger.error(f"Error calculating duration: {e}")
#             return None
    
#     @staticmethod
#     def convert_to_unix_timestamp(iso_time: str) -> Optional[int]:
#         """Convert ISO timestamp to Unix timestamp"""
#         try:
#             dt = datetime.fromisoformat(iso_time.replace('Z', '+00:00'))
#             return int(dt.timestamp())
#         except Exception as e:
#             logger.error(f"Error converting timestamp: {e}")
#             return None
    
#     @staticmethod
#     def count_messages_from_transcript(transcript: list) -> int:
#         """Count total messages in conversation transcript"""
#         return len(transcript) if transcript else 0
    
#     @staticmethod
#     def determine_call_status(payload: AICallWebhookPayload) -> str:
#         """Determine call status from webhook payload"""
#         if hasattr(payload, 'conversation_analysis') and payload.conversation_analysis:
#             return "completed"
#         elif hasattr(payload, 'error') and payload.error:
#             return "failed"
#         else:
#             return "unknown"
    
#     @staticmethod
#     def determine_call_success(payload: AICallWebhookPayload) -> bool:
#         """Determine if call was successful"""
#         return (hasattr(payload, 'conversation_analysis') and 
#                 payload.conversation_analysis is not None and
#                 not (hasattr(payload, 'error') and payload.error))


# @router.post("/elevenlabs-call-log", status_code=201)
# async def save_elevenlabs_call_log(payload: AICallWebhookPayload):
#     """
#     Save ElevenLabs call log from webhook payload
    
#     Args:
#         payload: AICallWebhookPayload containing call information
        
#     Returns:
#         dict: Success message with conversation_id
        
#     Raises:
#         HTTPException: If processing fails
#     """
#     try:
#         logger.info(f"Processing webhook for conversation_id: {payload.conversation_id}")
        
#         # Extract metadata
#         metadata = payload.metadata if hasattr(payload, 'metadata') else {}
#         start_time_str = metadata.get('start_time')
#         end_time_str = metadata.get('end_time')
        
#         # Calculate timestamps and duration
#         start_time_unix_secs = None
#         call_duration_secs = None
        
#         if start_time_str:
#             start_time_unix_secs = ElevenLabsWebhookService.convert_to_unix_timestamp(start_time_str)
        
#         if start_time_str and end_time_str:
#             call_duration_secs = ElevenLabsWebhookService.calculate_call_duration(
#                 start_time_str, end_time_str
#             )
        
#         # Count messages from transcript
#         transcript = []
#         if hasattr(payload, 'conversation_analysis') and payload.conversation_analysis:
#             transcript = getattr(payload.conversation_analysis, 'transcript', [])
        
#         message_count = ElevenLabsWebhookService.count_messages_from_transcript(transcript)
        
#         # Get agent name (you might want to fetch this from database or API)
#         agent_name = None
#         if payload.agent_id:
#             try:
#                 # Try to get agent from database
#                 agent = await AIAgent.find_one(AIAgent.agent_id == payload.agent_id)
#                 agent_name = agent.name if agent else None
#             except Exception as e:
#                 logger.warning(f"Could not fetch agent name: {e}")
        
#         # Create AICallLog instance
#         call_log = AICallLog(
#             agent_id=payload.agent_id,
#             agent_name=agent_name,
#             conversation_id=payload.conversation_id,
#             start_time_unix_secs=start_time_unix_secs,
#             call_duration_secs=call_duration_secs,
#             message_count=message_count,
#             status=ElevenLabsWebhookService.determine_call_status(payload),
#             call_successful=ElevenLabsWebhookService.determine_call_success(payload),
#             direction="inbound"  # You might want to determine this based on your logic
#         )
        
#         # Save to database
#         await call_log.save()
        
#         logger.info(f"Successfully saved call log for conversation: {payload.conversation_id}")
        
#         return {
#             "status": "success",
#             "message": "Call log saved successfully",
#             "conversation_id": payload.conversation_id,
#             "call_duration_secs": call_duration_secs,
#             "message_count": message_count
#         }
        
#     except Exception as e:
#         logger.error(f"Error processing ElevenLabs webhook: {str(e)}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to process webhook: {str(e)}"
#         )


# @router.get("/elevenlabs-call-logs", status_code=200)
# async def get_elevenlabs_call_logs(
#     agent_id: Optional[str] = None,
#     limit: int = 50,
#     skip: int = 0
# ):
#     """
#     Get ElevenLabs call logs with optional filtering
    
#     Args:
#         agent_id: Optional agent ID to filter by
#         limit: Maximum number of records to return
#         skip: Number of records to skip
        
#     Returns:
#         dict: Call logs and metadata
#     """
#     try:
#         query = AICallLog.find()
        
#         if agent_id:
#             query = query.find(AICallLog.agent_id == agent_id)
        
#         # Get total count
#         total_count = await query.count()
        
#         # Get paginated results
#         call_logs = await query.skip(skip).limit(limit).to_list()
        
#         return {
#             "status": "success",
#             "data": call_logs,
#             "total_count": total_count,
#             "limit": limit,
#             "skip": skip
#         }
        
#     except Exception as e:
#         logger.error(f"Error fetching call logs: {str(e)}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to fetch call logs: {str(e)}"
#         )


# @router.get("/elevenlabs-call-logs/{conversation_id}", status_code=200)
# async def get_elevenlabs_call_log_by_id(conversation_id: str):
#     """
#     Get specific ElevenLabs call log by conversation ID
    
#     Args:
#         conversation_id: Conversation ID to fetch
        
#     Returns:
#         dict: Call log data
        
#     Raises:
#         HTTPException: If call log not found
#     """
#     try:
#         call_log = await AICallLog.find_one(AICallLog.conversation_id == conversation_id)
        
#         if not call_log:
#             raise HTTPException(
#                 status_code=404,
#                 detail=f"Call log not found for conversation_id: {conversation_id}"
#             )
        
#         return {
#             "status": "success",
#             "data": call_log
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error fetching call log: {str(e)}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to fetch call log: {str(e)}"
#         )


# @router.delete("/elevenlabs-call-logs/{conversation_id}", status_code=200)
# async def delete_elevenlabs_call_log(conversation_id: str):
#     """
#     Delete ElevenLabs call log by conversation ID
    
#     Args:
#         conversation_id: Conversation ID to delete
        
#     Returns:
#         dict: Success message
        
#     Raises:
#         HTTPException: If call log not found
#     """
#     try:
#         call_log = await AICallLog.find_one(AICallLog.conversation_id == conversation_id)
        
#         if not call_log:
#             raise HTTPException(
#                 status_code=404,
#                 detail=f"Call log not found for conversation_id: {conversation_id}"
#             )
        
#         await call_log.delete()
        
#         logger.info(f"Deleted call log for conversation: {conversation_id}")
        
#         return {
#             "status": "success",
#             "message": f"Call log deleted for conversation: {conversation_id}"
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error deleting call log: {str(e)}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to delete call log: {str(e)}"
#         )


# @router.get("/elevenlabs-call-analytics", status_code=200)
# async def get_call_analytics(
#     agent_id: Optional[str] = None,
#     days: int = 7
# ):
#     """
#     Get call analytics from post-call webhook data
    
#     Args:
#         agent_id: Optional agent ID to filter by
#         days: Number of days to analyze (default: 7)
        
#     Returns:
#         dict: Call analytics and metrics
#     """
#     try:
#         # Calculate date range
#         from datetime import datetime, timedelta
#         end_date = datetime.utcnow()
#         start_date = end_date - timedelta(days=days)
#         start_unix = int(start_date.timestamp())
        
#         # Build query
#         query = AICallLog.find(AICallLog.start_time_unix_secs >= start_unix)
#         if agent_id:
#             query = query.find(AICallLog.agent_id == agent_id)
        
#         call_logs = await query.to_list()
        
#         # Calculate analytics
#         total_calls = len(call_logs)
#         successful_calls = len([log for log in call_logs if log.call_successful])
#         total_duration = sum([log.call_duration_secs or 0 for log in call_logs])
#         total_messages = sum([log.message_count or 0 for log in call_logs])
        
#         analytics = {
#             "period_days": days,
#             "total_calls": total_calls,
#             "successful_calls": successful_calls,
#             "success_rate": (successful_calls / total_calls * 100) if total_calls > 0 else 0,
#             "total_duration_seconds": total_duration,
#             "average_duration_seconds": (total_duration / total_calls) if total_calls > 0 else 0,
#             "total_messages": total_messages,
#             "average_messages_per_call": (total_messages / total_calls) if total_calls > 0 else 0,
#             "agent_breakdown": {}
#         }
        
#         # Agent breakdown
#         agent_stats = {}
#         for log in call_logs:
#             agent_id_key = log.agent_id or "unknown"
#             if agent_id_key not in agent_stats:
#                 agent_stats[agent_id_key] = {
#                     "agent_name": log.agent_name,
#                     "total_calls": 0,
#                     "successful_calls": 0,
#                     "total_duration": 0
#                 }
            
#             agent_stats[agent_id_key]["total_calls"] += 1
#             if log.call_successful:
#                 agent_stats[agent_id_key]["successful_calls"] += 1
#             agent_stats[agent_id_key]["total_duration"] += log.call_duration_secs or 0
        
#         analytics["agent_breakdown"] = agent_stats
        
#         return {
#             "status": "success",
#             "analytics": analytics
#         }
        
#     except Exception as e:
#         logger.error(f"Error generating analytics: {str(e)}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to generate analytics: {str(e)}"
#         )


# @router.post("/debug/elevenlabs-payload", status_code=200)
# async def debug_elevenlabs_payload(request: Request):
#     """
#     Debug endpoint to see exactly what ElevenLabs is sending
#     Use this temporarily to understand the webhook structure
#     """
#     try:
#         # Get all request information
#         headers = dict(request.headers)
#         raw_payload = await request.json()
        
#         logger.info(f"🔍 DEBUG - Headers: {headers}")
#         logger.info(f"🔍 DEBUG - Payload: {raw_payload}")
        
#         return {
#             "status": "debug",
#             "message": "Webhook payload captured for debugging",
#             "headers": headers,
#             "payload": raw_payload,
#             "payload_keys": list(raw_payload.keys()) if isinstance(raw_payload, dict) else "Not a dict",
#             "payload_type": type(raw_payload).__name__
#         }
        
#     except Exception as e:
#         logger.error(f"Debug endpoint error: {e}")
#         return {
#             "status": "error",
#             "message": f"Debug failed: {str(e)}"
#         }


# @router.post("/webhook/test-elevenlabs", status_code=200)
# async def test_elevenlabs_webhook():
#     """
#     Test endpoint to simulate ElevenLabs post-call webhook
#     Useful for development and testing
#     """
#     try:
#         # Simulate webhook payload
#         test_payload = {
#             "conversation_id": f"test_conv_{int(datetime.utcnow().timestamp())}",
#             "agent_id": "test_agent_123",
#             "metadata": {
#                 "start_time": "2024-01-15T10:30:00Z",
#                 "end_time": "2024-01-15T10:35:30Z",
#                 "direction": "inbound"
#             },
#             "conversation_analysis": {
#                 "transcript": [
#                     {"role": "agent", "content": "Hello, how can I help you?"},
#                     {"role": "user", "content": "I need help with my account"},
#                     {"role": "agent", "content": "I'd be happy to help with that"}
#                 ],
#                 "summary": "Customer inquiry about account help"
#             }
#         }
        
#         logger.info("🧪 Processing test webhook payload")
        
#         return {
#             "status": "success",
#             "message": "Test webhook ready for processing",
#             "test_payload": test_payload,
#             "webhook_url": "/webhook/elevenlabs-call-log"
#         }
        
#     except Exception as e:
#         logger.error(f"Error in test webhook: {str(e)}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Test webhook failed: {str(e)}"
#         )


# @router.get("/health", status_code=200)
# async def webhook_health_check():
#     """Health check endpoint for webhook service"""
#     return {
#         "status": "healthy",
#         "service": "elevenlabs-webhook-handler",
#         "timestamp": datetime.utcnow().isoformat()
#     }