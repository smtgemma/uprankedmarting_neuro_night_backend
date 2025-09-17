from pydantic import BaseModel, Field
from beanie import Document, Link, PydanticObjectId
from typing import List, Optional
from datetime import datetime, timezone
from enum import Enum
from bson import ObjectId

# Enum for Call Status
class CallStatus(Enum):
    INITIATED = "initiated"
    RINGING = "ringing"
    IN_PROGRESS = "in-progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BUSY = "busy"
    NO_ANSWER = "no-answer"
    CANCELED = "canceled"

# Enum for Call Type
class CallType(Enum):
    INCOMING = "incoming"
    OUTGOING = "outgoing"

# Enum for Direction (Used for both Twilio and Eleven Labs)
class Direction(Enum):
    INCOMING = "incoming"
    OUTGOING = "outgoing"


# TimestampedModel for common timestamp fields
class TimestampedModel(BaseModel):
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AICallWebhookPayload(BaseModel):
    agent_id: str
    agent_name: Optional[str] = None
    conversation_id: Optional[str] = None
    start_time_unix_secs: Optional[int] = None
    call_duration_secs: Optional[int] = None
    message_count: Optional[int] = None
    status: Optional[CallStatus] = None
    call_successful: Optional[bool] = None
    direction: Optional[Direction] = None

# Organization Model
class Organization(TimestampedModel, Document):
    id: PydanticObjectId = Field(default=None, alias="_id")
    name: str  
    industry: str  
    address: str  
    websiteLink: str  
    ownerId: PydanticObjectId  
    leadQuestions: List[str]  
    organizationNumber: str  

    class Settings:
        collection = "organizations"  


# Agent Model
class Agent(TimestampedModel, Document):
    id: PydanticObjectId = Field(default=None, alias="_id")
    userId: PydanticObjectId  
    status: str  
    sip_address: str  
    sip_username: str  
    sip_password: str  
    dateOfBirth: Optional[datetime] = None  
    gender: str  
    address: str  
    emergencyPhone: str  
    ssn: str  
    skills: List[str]  
    isAvailable: bool  
    jobTitle: str  
    employmentType: str  
    department: str  
    startWorkDateTime: Optional[datetime] = None  
    endWorkDateTime: Optional[datetime] = None  
    totalCalls: int  
    successCalls: int  
    droppedCalls: int  
    assignTo: PydanticObjectId  
    last_activity: datetime  

    class Settings:
        collection = "agents"  


# AICallLog Model for Eleven Labs
# class AICallLog(TimestampedModel, Document):  # Changed to Document
#     agent_id: str  
#     agent_name: Optional[str] = None  
#     conversation_id: Optional[str] = None  
#     start_time_unix_secs: Optional[int] = None  
#     call_duration_secs: Optional[int] = None  
#     message_count: Optional[int] = None  
#     status: Optional[CallStatus] = None  
#     call_successful: Optional[bool] = None  
#     direction: Optional[Direction] = None  

#     class Settings:
#         collection = "aicalllogs"  


# AIAgent Model
class AIAgent(Document,TimestampedModel):
    agentId: str
    organizationId: ObjectId 
    
    class Settings:
        collection = "aiagents"

    class Config:
        arbitrary_types_allowed = True  # Allow arbitrary types like ObjectId


# AICallLog Model for Eleven Labs
class AICallLog(TimestampedModel, Document):  # Changed to Document
    id: PydanticObjectId = Field(default=None, alias="_id")
    call_sid: str = Field(..., description="Twilio CallSid")
    organizationId: Optional[PydanticObjectId] = None
    agent_id: str  
    conversation_id: Optional[str] = None
    from_number: str
    to_number: str
    callType: CallType
    call_status: CallStatus
    call_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    call_started_at: Optional[datetime] = None
    call_completed_at: Optional[datetime] = None
    call_duration: Optional[int] = None
    # recording_url: Optional[str] = None
    recording_duration: Optional[int] = None
    call_transcript: Optional[str] = None
    # recording_sid: Optional[str] = None  

    class Settings:
        collection = "aicalllogs"  


# Call Model
class Call(TimestampedModel, Document):
    id: PydanticObjectId = Field(default=None, alias="_id")
    call_sid: str = Field(..., description="Twilio CallSid")
    organizationId: Optional[PydanticObjectId] = None
    agentId: Optional[PydanticObjectId] = None
    from_number: str
    to_number: str
    callType: CallType
    call_status: CallStatus
    call_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    call_started_at: Optional[datetime] = None
    call_completed_at: Optional[datetime] = None
    call_duration: Optional[int] = None
    recording_url: Optional[str] = None
    recording_duration: Optional[int] = None
    call_transcript: Optional[str] = None
    recording_sid: Optional[str] = None

    class Settings:
        collection = "call_records"
        indexes = [
            [("call_sid", 1)],  # Removed instance_id from index
            [("agentId", 1), ("call_time", -1)],
            [("organizationId", 1), ("call_time", -1)],
            [("call_status", 1), ("call_time", -1)]
        ]
