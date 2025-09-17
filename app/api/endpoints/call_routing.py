from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from twilio.rest import Client
from app.core.config import settings
from app.db.database_connection import get_database


# Twilio credentials
TWILIO_ACCOUNT_SID = settings.TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN = settings.TWILIO_AUTH_TOKEN
twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
webhook_url = settings.WEBHOOK_URL

router = APIRouter(tags=["Human Agent Call Routing"])


# Input model
class AutoRouteRequest(BaseModel):
    payment_status: str
    phone: str
    sid: str 
    plan: str
    

@router.post("/twilio/auto-route")
async def auto_route(data: AutoRouteRequest, db=Depends(get_database)):
    """
    Automates the webhook setup for a Twilio number
    to handle inbound calls with real agents.
    """
    try:
        # 1️⃣ Check payment
        if data.plan.strip().lower() != "only_real_agent":
            raise HTTPException(status_code=403, detail="Plan must be real agnet")
        if data.payment_status.strip() != "COMPLETED":
            raise HTTPException(status_code=403, detail="Payment not successful.")

        # 2️⃣ Find the Twilio phone number SID
        sid_to_use = data.sid
        if not sid_to_use:
            numbers = twilio_client.incoming_phone_numbers.list(limit=50)
            matched_number = next((n for n in numbers if n.phone_number == data.phone), None)
            if not matched_number:
                raise HTTPException(status_code=404, detail="Twilio phone number not found")
            sid_to_use = matched_number.sid

        

        # 3️⃣ Update the webhook URL to point to inbound call handler
        updated = twilio_client.incoming_phone_numbers(sid_to_use).update(
            voice_url=f"{webhook_url}twilio/inbound-call",
            status_callback=f"{webhook_url}twilio/call-status",  
            status_callback_method="POST" 
        )
        

        return {
            "message": "Webhook updated successfully. All calls will now be routed to available agents.",
            "sid": updated.sid,
            "phone_number": updated.phone_number,
            "mode": data.plan,
            "new_voice_url": updated.voice_url
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))