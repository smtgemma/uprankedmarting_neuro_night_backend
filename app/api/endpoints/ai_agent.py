from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List
from pydantic import BaseModel
import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError
import logging
from app.services.elevenlabs import create_eleven_agent, update_eleven_agent, get_agent_data
from app.db.database_connection import get_database
from bson import ObjectId
from datetime import datetime
from app.services.prompt import generate_elevenlabs_prompt
from app.api.models.ai_agent_model import AIAgent
from app.core.config import settings

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
    sip: str  # Maps to Agent.sip_address
    status: str

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

class AgentUpdateRequest(BaseModel):
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

class AgentDataResponse(BaseModel):
    first_message: Optional[str] = None
    knowledge_base_ids: Optional[List[str]] = []
    max_duration_seconds: Optional[int] = None
    stability: Optional[float] = None
    speed: Optional[float] = None
    similarity_boost: Optional[float] = None
    llm: Optional[str] = None
    temperature: Optional[float] = None
    daily_limit: Optional[int] = None

# ----------------------------
# Helper: Fetch organization by ID
# ----------------------------

async def get_org_by_id(org_id: str, db=Depends(get_database)) -> OrganizationResponse:
    # --- Validate org_id ---
    try:
        oid = ObjectId(org_id)
    except Exception:
        logger.error(f"Invalid organization_id: {org_id}")
        raise HTTPException(status_code=400, detail="Invalid organization_id")

    # --- Fetch organization data ---
    org_data = await db.organizations.find_one({"_id": oid})
    logger.info(f"org_data: {org_data}")
    if not org_data:
        raise HTTPException(status_code=404, detail="Organization not found")

    # --- Fetch latest active subscription ---
    subscription = await db.subscriptions.find_one(
        {
            "$or": [
                {"organizationId": oid},
                {"organizationId": str(org_id)}
            ],
            "status": "ACTIVE",
        },
        sort=[("createdAt", -1)]
    )
    logger.info(f"subscription: {subscription}")

    # --- Fetch voice data ---
    voice_data = await db.UploadVoice.find_one(
        {"organizationId": str(org_id)},
        {"voiceId": 1, "voiceName": 1, "_id": 0}
    )
    if voice_data:
        logger.info(f"Voice data for org {org_id}: {voice_data}")
    else:
        logger.info(f"No voice data found for org {org_id}")

    # --- Fetch approved agent assignments ---
    # --- Fetch approved assignments for this organization ---
    approved_assignments = await db.AgentAssignment.find(
        {"status": "APPROVED", "organizationId": ObjectId(org_id)}
    ).to_list(length=None)
    logger.info(f"approved_assignments: {approved_assignments}")

    # --- FIX: Use the correct key 'agentUserId' ---
    agent_ids = [assignment["agentUserId"] for assignment in approved_assignments]
    # --- END OF FIX ---

    # --- Fetch agent details using the correct agent_ids ---
    if agent_ids:
        agents_data = await db.agents.find(
            {"userId": {"$in": agent_ids}} # Assuming agent_ids are ObjectIds
        ).to_list(length=None)
    else:
        agents_data = []

    logger.info(f"Agents found for org {org_id}: {len(agents_data)}")

    assign_agents_list = [
        AgentModel(
            id=str(agent.get("_id", "")),
            sip=agent.get("sip_address", ""),
            status = agent.get("status","")
        )
        for agent in agents_data
    ]

    # --- Fetch Knowledge Bases ---
    raw_kbs = await db.AiknowledgeBase.find(
        {"organizationId": str(org_data["_id"])}
    ).to_list(length=None)

    knowledge_bases_list = [
        KnowledgeBaseModel(
            id=kb["knowledgeBaseId"],
            name=kb["knowledgeBaseName"]
        )
        for kb in raw_kbs
        if "knowledgeBaseId" in kb and "knowledgeBaseName" in kb
    ]
    logger.info(f"Knowledge bases processed: {knowledge_bases_list}")

    #---- Fetch Lead Question
    raw_questions = await db.questions.find({"org_id": org_id}).to_list(length=None)
    print("raw_questions", raw_questions)
    question_texts = [q.get("question_text", "") for q in raw_questions]


    # --- Build Response ---
    return OrganizationResponse(
        id=str(org_data["_id"]),
        business_name=org_data.get("name", ""),
        business_phone=subscription.get("purchasedNumber") if subscription else None,
        industry=org_data.get("industry", ""),
        current_plan_type=subscription.get("planLevel") if subscription else org_data.get("planType", "ai_then_real_agent"),
        voice_id=VoiceIDModel(
            voice_id=voice_data.get("voiceId", ""),
            voice_name=voice_data.get("voiceName", "")
        ) if voice_data else None,
        assign_agents=assign_agents_list,
        knowledge_bases=knowledge_bases_list,
        lead_questions=question_texts,
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
    # Filter knowledge bases correctly (this part of your code is fine)
    if knowledge_base_ids is not None:
        selected_kb_ids = set(knowledge_base_ids)
        kb_payload = [
            {"id": kb.id, "name": kb.name, "type": "file"}
            for kb in org.knowledge_bases
            if kb.id in selected_kb_ids
        ]
    else:
        kb_payload = [
            {"id": kb.id, "name": kb.name, "type": "file"}
            for kb in org.knowledge_bases
        ]

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
                    "knowledge_base": kb_payload,
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
                "enable_conversation_initiation_client_data_from_webhook": True,
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
            },
            "workspace_overrides": {
                "webhooks": {
                    "post_call_webhook_id": "0943e7f2a8f446df938787dd84ef82b5"
                }
            }
        },
        "name": f"{org.business_name} AI Agent"
    }

    # Add transfer logic for ai_then_real_agent plan
    if org.current_plan_type == "ai_then_real_agent" and org.assign_agents:
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
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Create an AI agent for the specified organization and link it to a phone number.

    Args:
        org_id (str): The organization ID.
        req (AgentCreateRequest): Request payload for agent creation.
        db (AsyncIOMotorDatabase): MongoDB database instance.

    Returns:
        dict: Response containing agent creation and linking details.

    Raises:
        HTTPException: If validation fails, agent creation fails, or linking fails.
    """
    # Validate organization
    logger.info(f"Creating AI agent for org_id: {org_id}")
    org = await get_org_by_id(org_id, db)
    if not org:
        logger.error(f"Organization not found: {org_id}")
        raise HTTPException(status_code=404, detail=f"Organization not found: {org_id}")

    # Validate org_id as ObjectId
    try:
        org_id_obj = ObjectId(org_id)
    except Exception as e:
        logger.error(f"Invalid organizationId: {org_id}, error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid organizationId: {org_id}")

    # Check if an AI agent already exists
    existing_agent = await db.aiagents.find_one({"organizationId": org_id_obj})
    if existing_agent:
        logger.warning(f"AI agent already exists for organizationId: {org_id}, agent_id: {existing_agent.get('agentId')}")
        raise HTTPException(
            status_code=409,
            detail=f"AI agent already exists for this organization (agent_id: {existing_agent.get('agentId')})"
        )

    # Generate ElevenLabs prompt
    prompt = generate_elevenlabs_prompt(
        agent_name=f"{org.business_name} Call Center Agent",
        organization_name=org.business_name,
        industry_name=org.industry,
        lead_questions=org.lead_questions,
        callback_timeframe="30 minutes"
    )

    # Build ElevenLabs payload
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
        logger.debug(f"ElevenLabs payload: {payload}")
    except ValueError as e:
        logger.error(f"Payload build failed for org_id {org_id}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid payload: {str(e)}")

    # Call ElevenLabs service
    agent_response = await create_eleven_agent(payload)
    agent_id = agent_response.get("agent_id")
    if not agent_id:
        logger.error(f"Agent creation failed for org_id {org_id}: no agent_id returned")
        raise HTTPException(status_code=500, detail="Agent creation failed, no agent_id returned.")

    # Create AI agent document
    ai_agent = AIAgent(
        agentId=agent_id,
        organizationId=org_id_obj,
    )

    # Insert into aiagents collection
    try:
        result = await db.aiagents.insert_one(ai_agent.model_dump(exclude={"id"}))
        logger.info(f"AI agent created successfully for org_id {org_id}, agent_id: {agent_id}, inserted_id: {str(result.inserted_id)}")
    except DuplicateKeyError:
        logger.error(f"Duplicate key error for organizationId: {org_id}")
        raise HTTPException(status_code=409, detail="AI agent creation failed due to duplicate organizationId")
    except Exception as e:
        logger.error(f"Failed to create AI agent for org_id {org_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create AI agent: {str(e)}")


    # Link agent with organization
    business_phone = org.business_phone
    label = f"{org.business_name} AI Agent connection"

    async with httpx.AsyncClient() as client:
        org_api_url = f"{settings.WEBHOOK_URL}/ai-call-routing/assign-phone-to-ai-agent"
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
# ----------------------------
# Endpoint: Update Agent
# ----------------------------
@router.patch("/{org_id}/agents/{agent_id}")
async def update_agent(
    org_id: str,
    agent_id: str,
    req: AgentUpdateRequest,
    db=Depends(get_database)
):
    """
    Partially updates an existing AI agent's configuration using PATCH.
    """
    # 1. Validate: Check if the agent exists in our database and belongs to the specified organization.
    # This prevents users from updating agents that aren't theirs.
    existing_agent = await db.aiagents.find_one({"agentId": agent_id, "organizationId": org_id})
    if not existing_agent:
        raise HTTPException(status_code=404, detail=f"Agent with ID {agent_id} not found or does not belong to organization {org_id}")

    # 2. Build the PARTIAL payload dynamically based on the request.
    # This structure must exactly match the ElevenLabs API documentation.
    update_data = req.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update fields were provided in the request body.")

    # We build the 'agent' object first, which will contain all our updates.
    agent_payload_part = {}
    
    # Handle direct properties of the 'agent' object
    if "first_message" in update_data:
        agent_payload_part["first_message"] = update_data["first_message"]
    
    # Handle nested objects like 'prompt'
    prompt_payload_part = {}
    if "knowledge_base_ids" in update_data:
        # We only fetch the full organization data if we need to update knowledge bases.
        org = await get_org_by_id(org_id, db)
        selected_kb_ids = set(update_data["knowledge_base_ids"])
        prompt_payload_part["knowledge_base"] = [
            {"id": kb.id, "name": kb.name, "type": "file"}
            for kb in org.knowledge_bases
            if kb.id in selected_kb_ids
        ]

    # If we added anything to the prompt part, we add the entire prompt object to the agent part.
    if prompt_payload_part:
        agent_payload_part["prompt"] = prompt_payload_part

    # Finally, construct the full, top-level payload in the required nested structure.
    final_payload = {
        "conversation_config": {
            "agent": agent_payload_part
        }
    }

    # 3. Call the ElevenLabs PATCH service with the correctly structured payload.
    try:
        update_response = await update_eleven_agent(agent_id, final_payload)
        logger.info(f"Successfully PATCHED agent {agent_id} at ElevenLabs.")
    except httpx.HTTPStatusError as e:
        logger.error(f"Failed to PATCH ElevenLabs agent {agent_id}: {e.response.text}")
        raise HTTPException(status_code=e.response.status_code, detail=f"Failed to update agent at external service: {e.response.text}")

    # 4. Update the 'updatedAt' timestamp in our local database to reflect the change.
    await db.aiagents.update_one(
        {"_id": existing_agent["_id"]},
        {"$set": {"updatedAt": datetime.utcnow()}}
    )

    return {
        "status": "success",
        "message": f"Agent {agent_id} was successfully updated.",
        "update_response": update_response
    }

# ----------------------------
# Endpoint: Get Agent Info
# ----------------------------
@router.get("/{org_id}/agents/{agent_id}", response_model=AgentDataResponse)
async def get_agent_info(org_id: str, agent_id: str):
    try:
        data = await get_agent_data(agent_id)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Extract the relevant fields
    return {
    "first_message": data.get("conversation_config", {}).get("agent", {}).get("first_message"),
    "knowledge_base_ids": [
        kb.get("id") for kb in data.get("conversation_config", {}).get("agent", {}).get("prompt", {}).get("knowledge_base", [])
        if isinstance(kb, dict) and "id" in kb
    ],
    "max_duration_seconds": data.get("conversation_config", {}).get("conversation", {}).get("max_duration_seconds"),
    "stability": data.get("conversation_config", {}).get("tts", {}).get("stability"),
    "speed": data.get("conversation_config", {}).get("tts", {}).get("speed"),
    "similarity_boost": data.get("conversation_config", {}).get("tts", {}).get("similarity_boost"),
    "llm": data.get("conversation_config", {}).get("agent", {}).get("prompt", {}).get("llm"),
    "temperature": data.get("conversation_config", {}).get("agent", {}).get("prompt", {}).get("temperature"),
    "daily_limit": data.get("platform_settings", {}).get("call_limits", {}).get("daily_limit")
}