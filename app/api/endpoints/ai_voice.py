import httpx
from fastapi import APIRouter, UploadFile, Form, Depends, HTTPException
from bson import ObjectId
from datetime import datetime, timezone
from fastapi.responses import JSONResponse
from app.db.database_connection import get_database
import logging
from app.core.config import settings
logger = logging.getLogger(__name__)

router = APIRouter(tags=["Organization Voice Clone"])

ELEVENLABS_API_KEY = settings.ELEVENLABS_API_KEY
ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1/voices/add"

def now_utc():
    """Return current UTC time as timezone-aware datetime."""
    return datetime.now(timezone.utc)

@router.post("/organization-voice/organization/{organization_id}/voice-clone")
async def clone_voice(
    organization_id: str,
    file: UploadFile,
    name: str = Form(...),
    description: str = Form(""),
    remove_background_noise: bool = Form(True),
    db=Depends(get_database),
):
    """
    Clone a voice for the given organization using ElevenLabs API.
    Saves metadata in MongoDB collection `UploadVoice`.
    Returns JSON response with DB record and ElevenLabs response.
    """
    # --- Validate organization ---
    try:
        org_obj_id = ObjectId(organization_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid organization_id")

    organization = await db.organizations.find_one({"_id": org_obj_id})
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    try:
        # --- Prepare file and data for ElevenLabs ---
        files = {
            "files": (file.filename, await file.read(), file.content_type or "audio/mpeg")
        }
        data = {
            "name": name,
            "description": description,
            "remove_background_noise": str(remove_background_noise).lower()
        }
        headers = {"xi-api-key": ELEVENLABS_API_KEY}

        # --- Call ElevenLabs API ---
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                ELEVENLABS_BASE_URL,
                headers=headers,
                data=data,
                files=files
            )

        if response.status_code != 200:
            return JSONResponse(
                status_code=response.status_code,
                content={"error": True, "message": response.text}
            )

        elevenlabs_data = response.json()
        voice_id = elevenlabs_data.get("voice_id") or elevenlabs_data.get("id")
        if not voice_id:
            return JSONResponse(
                status_code=500,
                content={"error": True, "message": "ElevenLabs response missing voice_id"}
            )

        # --- Save metadata to UploadVoice collection ---
        db_record = {
            "voiceId": voice_id,
            "voiceName": name,
            "requires_verification": False,  # default
            "organizationId": organization_id,
            "createdAt": now_utc(),
            "updatedAt": now_utc()
        }

        result = await db.UploadVoice.insert_one(db_record)
        db_record["_id"] = str(result.inserted_id)  # convert ObjectId to string
        # Convert datetime to ISO format for JSON response
        db_record["createdAt"] = db_record["createdAt"].isoformat()
        db_record["updatedAt"] = db_record["updatedAt"].isoformat()

        # --- Return response ---
        return JSONResponse(
            status_code=200,
            content={
                "message": "Voice cloned successfully",
                "db_record": db_record,
                "elevenlabs_response": elevenlabs_data
            }
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": True, "message": str(e)}
        )






def now_utc():
    return datetime.now(timezone.utc)

@router.delete("/organization-voice/organization/{organization_id}/voice/{voice_id}")
async def delete_voice(organization_id: str, voice_id: str, db=Depends(get_database)):
    """
    Delete a cloned voice in ElevenLabs and remove it from MongoDB `UploadVoice`.
    """
    try:
        # --- Find MongoDB record first ---
        voice_doc = await db.UploadVoice.find_one({
            "organizationId": organization_id,
            "voiceId": voice_id
        })

        if not voice_doc:
            raise HTTPException(status_code=404, detail="Voice record not found in database")

        # --- Delete from ElevenLabs API ---
        url = f"https://api.elevenlabs.io/v1/voices/{voice_id}"
        headers = {"xi-api-key": ELEVENLABS_API_KEY}

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(url, headers=headers)

        if response.status_code not in [200, 204]:
            logger.error(f"❌ ElevenLabs delete error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail="Failed to delete voice from ElevenLabs")

        # --- Delete from MongoDB ---
        delete_result = await db.UploadVoice.delete_one({
            "organizationId": organization_id,
            "voiceId": voice_id
        })

        db_status = "Deleted from DB successfully" if delete_result.deleted_count > 0 else "No record found in DB"

        # --- Return confirmation JSON ---
        return JSONResponse(
            status_code=200,
            content={
                "message": "Voice deleted successfully",
                "db_status": db_status,
                "voice_info": {
                    "voiceId": voice_doc.get("voiceId"),
                    "voiceName": voice_doc.get("voiceName"),
                    "organizationId": voice_doc.get("organizationId"),
                    "createdAt": voice_doc.get("createdAt").isoformat() if voice_doc.get("createdAt") else None
                },
                "elevenlabs_response_status": response.status_code
            }
        )

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error deleting voice: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
