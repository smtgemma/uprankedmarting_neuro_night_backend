#app/routes/twilio_webhooks.py

from datetime import datetime
from fastapi import APIRouter, Form, Request
from fastapi.responses import Response
from twilio.twiml.voice_response import VoiceResponse
from app.config import settings
from app.services.twilio_service import twilio_service
from app.services.queue_service import queue_service

router = APIRouter(prefix="/webhook")

@router.post("/incoming-call")
async def handle_incoming_call(
    CallSid: str = Form(...),
    From: str = Form(...),
    To: str = Form(...),
    CallStatus: str = Form(...),
):
    """Handle incoming call webhook from Twilio"""
    print(f"=== INCOMING CALL WEBHOOK ===")
    print(f"CallSid: {CallSid}")
    print(f"From: {From}")
    print(f"To: {To}")
    print(f"CallStatus: {CallStatus}")
    print("===============================")
    
    # Add caller to queue
    try:
        queue_service.add_caller(CallSid, From)
        print(f"Added caller {CallSid} to queue")
    except Exception as e:
        print(f"Error adding caller to queue: {e}")
    
    # Return simple TwiML
    twiml = twilio_service.create_incoming_call_twiml()
    print(f"Returning TwiML: {twiml}")
    return Response(content=twiml, media_type="application/xml")


@router.post("/queue-status")
async def handle_queue_status(
    CallSid: str = Form(...),
    QueueResult: str = Form(None),
    QueueTime: str = Form(None),
):
    """Handle queue status updates"""
    print(f"Queue status for {CallSid}: {QueueResult}")
    
    if QueueResult == "queue-full":
        # Handle queue full scenario
        response = VoiceResponse()
        response.say("We're sorry, but all our agents are currently busy. Please try calling back later.", 
                    voice='alice')
        response.hangup()
        return Response(content=str(response), media_type="application/xml")
    
    return Response(content="", status_code=200)

@router.post("/enqueue")
async def handle_enqueue(
    CallSid: str = Form(...),
    From: str = Form(...),
    QueuePosition: str = Form(None),
):
    """Handle caller being enqueued"""
    print(f"Caller enqueued: {CallSid} from {From}")
    
    # Add caller to our queue tracking
    queue_service.add_caller(CallSid, From)
    
    return Response(content="", status_code=200)

@router.post("/dequeue") 
async def handle_dequeue(
    CallSid: str = Form(...),
    From: str = Form(...),
    QueueResult: str = Form(...),
):
    """Handle caller being dequeued"""
    print(f"Caller dequeued: {CallSid}, Result: {QueueResult}")
    
    # Remove caller from our queue tracking
    queue_service.remove_caller(CallSid)
    
    return Response(content="", status_code=200)

@router.post("/queue-result")
async def handle_queue_result(
    CallSid: str = Form(...),
    QueueResult: str = Form(...),
):
    """Handle final queue result"""
    print(f"Queue result for {CallSid}: {QueueResult}")
    
    if QueueResult == "hangup":
        queue_service.remove_caller(CallSid)
    
    return Response(content="", status_code=200)

@router.post("/comfort-message")
async def comfort_message_post():
    """Serve comfort message for waiting callers - POST"""
    twiml = twilio_service.create_comfort_message_twiml()
    return Response(content=twiml, media_type="application/xml")

@router.get("/comfort-message") 
async def comfort_message_get():
    """Serve comfort message for waiting callers - GET"""
    twiml = twilio_service.create_comfort_message_twiml()
    return Response(content=twiml, media_type="application/xml")


@router.post("/connect-agent/{agent_identity}")
async def connect_agent(
    agent_identity: str,
    CallSid: str = Form(...),
):
    """Connect dequeued caller to specific agent"""
    print(f"Connecting {CallSid} to agent {agent_identity}")
    
    # Mark agent as busy
    queue_service.set_agent_busy(agent_identity, CallSid)
    
    # Return TwiML to connect to agent via WebRTC
    twiml = twilio_service.create_agent_connection_twiml(agent_identity)
    return Response(content=twiml, media_type="application/xml")

@router.post("/call-status")
async def handle_call_status(
    CallSid: str = Form(...),
    CallStatus: str = Form(...),
    From: str = Form(...),
    To: str = Form(...),
):
    """Handle call status updates"""
    print(f"Call status update: {CallSid} - {CallStatus}")
    
    if CallStatus in ["completed", "busy", "no-answer", "canceled", "failed"]:
        # Call ended - make agent available and remove from queue
        for agent_id, agent in queue_service.agents.items():
            if agent.current_call_sid == CallSid:
                queue_service.set_agent_available(agent_id)
                break
        
        queue_service.remove_caller(CallSid)
    
    return Response(content="", status_code=200)

@router.post("/dial-status")
async def handle_dial_status(
    CallSid: str = Form(...),
    DialCallStatus: str = Form(...),
):
    """Handle dial status updates"""
    print(f"Dial status for {CallSid}: {DialCallStatus}")
    
    if DialCallStatus in ["no-answer", "busy", "failed"]:
        # Agent didn't answer, put caller back in queue or handle gracefully
        response = VoiceResponse()
        response.say("The agent is currently unavailable. Please hold while we find another agent.", voice='alice')
        response.enqueue(settings.QUEUE_NAME)
        return Response(content=str(response), media_type="application/xml")
    
    return Response(content="", status_code=200)

@router.post("/client-status") 
async def handle_client_status(
    CallSid: str = Form(...),
    CallStatus: str = Form(...),
):
    """Handle WebRTC client status updates"""
    print(f"Client status for {CallSid}: {CallStatus}")
    return Response(content="", status_code=200)




@router.post("/debug")
async def debug_webhook(request: Request):
    """Debug webhook to see all Twilio parameters"""
    form_data = await request.form()
    print("Debug webhook received:")
    for key, value in form_data.items():
        print(f"  {key}: {value}")
    return Response(content="", status_code=200)

@router.get("/test")
async def test_endpoint():
    """Test endpoint to verify server is reachable"""
    return {"status": "server is running", "time": str(datetime.now())}