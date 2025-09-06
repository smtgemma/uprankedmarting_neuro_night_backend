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
