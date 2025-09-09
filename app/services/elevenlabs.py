import httpx
import os
from app.core.config import settings
ELEVEN_API_KEY = settings.ELEVENLABS_API_KEY

async def create_eleven_agent(payload: dict):
    url = "https://api.elevenlabs.io/v1/convai/agents/create"  # <-- correct endpoint
    headers = {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json()




async def update_eleven_agent(agent_id: str, partial_payload: dict) -> dict:
    """
    Partially updates an existing agent in ElevenLabs using the PATCH method.
    
    Args:
        agent_id: The ID of the agent to update.
        partial_payload: A dictionary containing only the fields to be changed.

    Returns:
        The JSON response from the ElevenLabs API.
    """
    if not ELEVEN_API_KEY:
        raise ValueError("ELEVENLABS_API_KEY is not set in environment variables.")

    headers = {
        "Content-Type": "application/json",
        "xi-api-key": ELEVEN_API_KEY
    }
    update_url = f"https://api.elevenlabs.io/v1/convai/agents/{agent_id}"

    async with httpx.AsyncClient() as client:
        response = await client.patch(update_url, headers=headers, json=partial_payload, timeout=30.0)
        # Raise an exception for bad status codes (4xx or 5xx)
        response.raise_for_status()
        return response.json()
