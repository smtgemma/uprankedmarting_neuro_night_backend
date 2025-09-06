from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List
from pydantic import BaseModel
import httpx
import logging
from app.services.elevenlabs import create_eleven_agent
from app.db.database_connection import get_database
from bson import ObjectId
from datetime import datetime
from app.services.prompt import generate_elevenlabs_prompt

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organizations", tags=["Organizations"])

# Pydantic Models
class VoiceIDModel(BaseModel):
    voice_id: str
    voice_name: str

class AgentModel(BaseModel):
    id: str
    sip: Optional[str]  # Maps to Agent.sip_address
    twilioIdentity: Optional[str]  # Maps to Agent.twilioIdentity

class KnowledgeBaseModel(BaseModel):
    id: str  # Maps to AiknowledgeBase.knowledgeBaseId
    name: str  # Maps to AiknowledgeBase.knowledgeBaseName

class AgentCreateRequest(BaseModel):
    first_message: Optional[str] = None
    knowledge_base_ids: Optional[List[str]] = None
    max_duration_seconds: Optional[int] = None
    stability: Optional[float] = None
    speed: Optional[float] = None
    similarity_boost: Optional[float] = None
    llm: Optional[str] = None
    temperature: Optional[float] = None
    daily_limit: Optional[int] = None

class OrganizationResponse(BaseModel):
    id: str
    business_name: str
    business_phone: str
    industry: str
    current_plan_type: str
    voice_id: Optional[VoiceIDModel] = None
    assign_agents: List[AgentModel] = []
    knowledge_bases: List[KnowledgeBaseModel] = []
    lead_questions: List[str] = []

# ----------------------------
# Helper: Fetch organization by ID
# ----------------------------
async def get_org_by_id(org_id: str, db=Depends(get_database)) -> OrganizationResponse:
    try:
        oid = ObjectId(org_id)
    except Exception:
        logger.error(f"Invalid organization_id: {org_id}")
        raise HTTPException(status_code=400, detail="Invalid organization_id")

    # Fetch organization data
    org_data = await db.organizations.find_one({"_id": oid})
    logger.info(f"org_data: {org_data}")
    if not org_data:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    #Fetch ogranization data
    subscription = await db.subscriptions.find_one({"organizationId": oid})
    print("subscription", subscription)

    # Fetch voice data
    voice_data = await db["UploadVoice"].find_one({"organizationId": str(org_id)})
    if voice_data:
        logger.info(f"Voice data for org {org_id}: {voice_data}")
    else:
        logger.info(f"No voice data found for org {org_id}")

    # Fetch agents
    agents_data = await db.agents.find({"assignTo": str(org_id)}).to_list(length=None)
    logger.info(f"Agents found: {len(agents_data)}")

    # Fetch knowledge bases
    raw_kbs = await db.AiknowledgeBase.find({"organizationId": str(org_data["_id"])}).to_list(length=None)
    knowledge_bases_list = [
        KnowledgeBaseModel(
            id=kb["knowledgeBaseId"],
            name=kb["knowledgeBaseName"]
        )
        for kb in raw_kbs
        if "knowledgeBaseId" in kb and "knowledgeBaseName" in kb
    ]
    logger.info(f"Knowledge bases processed: {knowledge_bases_list}")

    # Build response
    return OrganizationResponse(
        id=str(org_data["_id"]),
        business_name=org_data.get("name", ""),
        business_phone=subscription.get("purchasedNumber"),  # fallback
        industry=org_data.get("industry", ""),
        current_plan_type=org_data.get("planType", "ai_then_human"),  # fallback
        voice_id=VoiceIDModel(
            voice_id=voice_data["voiceId"],
            voice_name=voice_data.get("voiceName", "")
        ) if voice_data else None,
        assign_agents=[
            AgentModel(
                id=str(agent["_id"]),
                sip=agent.get("sip_address", ""),
                twilioIdentity=agent.get("twilioIdentity", "")
            ) for agent in agents_data
        ],
        knowledge_bases=knowledge_bases_list,
        lead_questions=org_data.get("leadQuestions", [])
    )


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(org_id: str, db=Depends(get_database)):
    org = await get_org_by_id(org_id, db)
    logger.info(f"Retrieved organization {org_id}")
    return org

# ----------------------------
# Build ElevenLabs Payload
# ----------------------------
def build_elevenlabs_payload(
    org: OrganizationResponse,
    first_message: Optional[str] = None,
    prompt: str = None,
    knowledge_base_ids: Optional[List[str]] = None,
    max_duration_seconds: Optional[int] = None,
    stability: Optional[float] = None,
    speed: Optional[float] = None,
    similarity_boost: Optional[float] = None,
    llm: Optional[str] = None,
    temperature: Optional[float] = None,
    daily_limit: Optional[int] = None
) -> dict:
    if org.current_plan_type == "only_real_agent":
        logger.error(f"Cannot create AI agent for plan: {org.current_plan_type}")
        raise ValueError("AI agents cannot be created for only_real_agent plan")

    # Defaults
    stability = stability if stability is not None else 0.5
    speed = speed if speed is not None else 1.0
    similarity_boost = similarity_boost if similarity_boost is not None else 0.8
    max_duration_seconds = max_duration_seconds if max_duration_seconds is not None else 600
    llm = llm if llm is not None else "gemini-2.5-flash"
    temperature = temperature if temperature is not None else 0
    daily_limit = daily_limit if daily_limit is not None else 100000
    knowledge_base_ids = knowledge_base_ids if knowledge_base_ids else [kb.id for kb in org.knowledge_bases]

    payload = {
        "conversation_config": {
            "asr": {
                "quality": "high",
                "provider": "elevenlabs",
                "user_input_audio_format": "ulaw_8000"
            },
            "turn": {
                "turn_timeout": 7,
                "silence_end_call_timeout": -1
            },
            "tts": {
                "voice_id": org.voice_id.voice_id if org.voice_id else "cjVigY5qzO86Huf0OWal",
                "agent_output_audio_format": "ulaw_8000",
                "optimize_streaming_latency": 3,
                "stability": stability,
                "speed": speed,
                "similarity_boost": similarity_boost
            },
            "conversation": {
                "text_only": False,
                "max_duration_seconds": max_duration_seconds,
                "client_events": [
                    "audio",
                    "interruption",
                    "user_transcript",
                    "agent_response",
                    "agent_response_correction"
                ]
            },
            "agent": {
                "first_message": first_message or "Hello, how can I assist you today?",
                "language": "en",
                "prompt": {
                    "prompt": prompt,
                    "llm": llm,
                    "temperature": temperature,
                    "max_tokens": -1,
                    "built_in_tools": {
                        "end_call": {
                            "name": "end_call",
                            "description": "Ends the call",
                            "params": {
                                "system_tool_type": "end_call",
                                "disable_interruptions": False,
                                "force_pre_tool_speech": False
                            }
                        },
                        "language_detection": {
                            "name": "language_detection",
                            "description": "Detects the language spoken by the user",
                            "params": {
                                "system_tool_type": "language_detection",
                                "disable_interruptions": False,
                                "force_pre_tool_speech": False
                            }
                        },
                    }
                },
                "knowledge_base": [
                    {"id": kb, "type": "file"} for kb in knowledge_base_ids
                ],
                "rag": {
                    "enabled": True,
                    "embedding_model": "multilingual_e5_large_instruct",
                    "max_vector_distance": 0.6,
                    "max_documents_length": 50000,
                    "max_retrieved_rag_chunks_count": 20
                }
            }
        },
        "platform_settings": {
            "overrides": {
                "conversation_config_override": {
                    "conversation": {
                        "text_only": False
                    },
                },
            },
            "call_limits": {
                "agent_concurrency_limit": -1,
                "daily_limit": daily_limit,
                "bursting_enabled": True
            }
        },
        "name": f"{org.business_name} AI Agent"
    }

    # Add transfer logic for ai_then_human plan
    if org.current_plan_type == "ai_then_human" and org.assign_agents:
        transfers = []
        for agent in org.assign_agents:
            if agent.sip:
                transfers.append({
                    "condition": "When user requests to transfer the call",
                    "transfer_destination": {
                        "sip_uri": agent.sip,
                        "type": "sip_uri"
                    },
                    "transfer_type": "sip_refer"
                })

        if transfers:
            payload["conversation_config"]["agent"]["prompt"]["built_in_tools"]["transfer_to_number"] = {
                "name": "transfer_to_number",
                "description": "Call will transfer to the real agent through SIP",
                "params": {
                    "transfers": transfers,
                    "system_tool_type": "transfer_to_number",
                    "enable_client_message": False,
                    "disable_interruptions": False,
                    "force_pre_tool_speech": False
                }
            }

    logger.info(f"Built ElevenLabs payload for org {org.id}")
    return payload

# ----------------------------
# Endpoint: Create Agent
# ----------------------------
@router.post("/create/{org_id}")
async def create_agent(
    org_id: str,
    req: AgentCreateRequest,
    db=Depends(get_database)
):
    org = await get_org_by_id(org_id, db)

    prompt = generate_elevenlabs_prompt(
        agent_name="SupportBot",
        organization_name=org.business_name,
        industry_name=org.industry,
        lead_questions=org.lead_questions,
        callback_timeframe="30 minutes"
    )

    try:
        payload = build_elevenlabs_payload(
            org,
            prompt=prompt,
            first_message=req.first_message,
            knowledge_base_ids=req.knowledge_base_ids,
            max_duration_seconds=req.max_duration_seconds,
            stability=req.stability,
            speed=req.speed,
            similarity_boost=req.similarity_boost,
            llm=req.llm,
            temperature=req.temperature,
            daily_limit=req.daily_limit
        )
    except ValueError as e:
        logger.error(f"Payload build failed: {str(e)}")
        raise HTTPException(status_code=403, detail=str(e))

    # Call ElevenLabs service
    agent_response = await create_eleven_agent(payload)
    agent_id = agent_response.get("agent_id")
    if not agent_id:
        logger.error("Agent creation failed: no agent_id returned")
        raise HTTPException(status_code=500, detail="Agent creation failed, no agent_id returned.")

    # Save to AiAgent collection
    ai_agent_doc = {
        "_id": ObjectId(),
        "agentId": agent_id,
        "organizationId": org_id,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    await db["aiagents"].insert_one(ai_agent_doc)
    logger.info(f"Saved AI agent {agent_id} for org {org_id}")

    # Link agent with organization
    business_phone = org.business_phone
    label = f"{org.business_name} AI Agent connection"

    async with httpx.AsyncClient() as client:
        org_api_url = f"http://127.0.0.1:8000/ai-call-routing/assign-phone-to-ai-agent"
        response = await client.post(
            org_api_url,
            json={
                "twilio_phone_number": business_phone,
                "agent_id": agent_id,
                "label": label
            }
        )

        if response.status_code != 200:
            logger.error(f"Failed to link agent to organization: {response.text}")
            raise HTTPException(status_code=500, detail=f"Failed to link agent to organization: {response.text}")

    logger.info(f"Linked AI agent {agent_id} to org {org_id}")
    return {
        "status": "success",
        "agent": agent_response,
        "organization_link": response.json()
    }