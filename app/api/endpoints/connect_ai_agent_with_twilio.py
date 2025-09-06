from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import requests
from app.core.config import settings

router = APIRouter(prefix="/ai-call-routing", tags=["AI Call Routing"])

# Config
ELEVENLABS_API_KEY = settings.ELEVENLABS_API_KEY
TWILIO_ACCOUNT_SID = settings.TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN = settings.TWILIO_AUTH_TOKEN
ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/convai"

# Request model
class PhoneAssignment(BaseModel):
    twilio_phone_number: str
    agent_id: str
    label: str = "Support Line"  # optional friendly label


@router.post("/assign-phone-to-ai-agent")
async def assign_phone_to_agent(assignment: PhoneAssignment):
    """
    Import a Twilio phone number into ElevenLabs and assign it to an agent.
    """

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
    }

    try:
        # Step 1: Import the Twilio phone number
        payload = {
            "phone_number": assignment.twilio_phone_number,
            "label": assignment.label,
            "sid": TWILIO_ACCOUNT_SID,
            "token": TWILIO_AUTH_TOKEN
        }

        response = requests.post(
            f"{ELEVENLABS_API_URL}/phone-numbers",
            json=payload,
            headers=headers
        )

        if response.status_code not in (200, 201):
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to import phone number: {response.text}"
            )

        phone_data = response.json()
        phone_number_id = phone_data.get("phone_number_id")
        if not phone_number_id:
            raise HTTPException(status_code=500, detail="No phone_number_id returned from ElevenLabs")

        # Step 2: Assign the imported number to an agent
        update_payload = {"agent_id": assignment.agent_id}
        update_resp = requests.patch(
            f"{ELEVENLABS_API_URL}/phone-numbers/{phone_number_id}",
            json=update_payload,
            headers=headers
        )

        if update_resp.status_code not in (200, 201):
            raise HTTPException(
                status_code=update_resp.status_code,
                detail=f"Failed to assign agent: {update_resp.text}"
            )

        return {
            "message": f"Successfully assigned {assignment.twilio_phone_number} to agent {assignment.agent_id}",
            "phone_number_id": phone_number_id,
            "elevenlabs_import": phone_data,
            "elevenlabs_update": update_resp.json()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}