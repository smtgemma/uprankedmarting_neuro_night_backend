# api/models.py (Updated for production)
from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
import uuid
from enum import Enum

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, handler=None):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        schema = handler(core_schema)
        schema.update(type="string")
        return schema

class ProcessingStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"

class Organization(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    _id: str = Field(...)
    name: str = Field(..., min_length=2, max_length=100)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class SingleQuestionCreate(BaseModel):
    _id: str = Field(..., min_length=1, max_length=50)
    question: str = Field(..., min_length=3, max_length=500)
    name: str = Field(..., min_length=2, max_length=100)
    
    @field_validator('question')
    def validate_question(cls, v):
        if len(v.strip()) < 3:
            raise ValueError('Question must be at least 3 characters long')
        return v.strip()


class QuestionUpdate(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)
    
    @field_validator('question')
    def validate_question(cls, v):
        if len(v.strip()) < 3:
            raise ValueError('Question must be at least 3 characters long')
        return v.strip()

class OrganizationQuestionsCreate(BaseModel):
    _id: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    questions: List[str] = Field(..., min_items=1, max_items=50)
    
    @field_validator('questions')
    def validate_questions(cls, v):
        if any(len(q.strip()) < 3 for q in v):
            raise ValueError('Each question must be at least 3 characters long')
        return [q.strip() for q in v]

class ConversationCreate(BaseModel):
    conv_id: str = Field(..., min_length=1, max_length=50)
    conv_script: str = Field(..., min_length=50, max_length=50000)
    
    @field_validator('conv_id')
    def validate_conv_id(cls, v):
        # Ensure conv_id is unique format
        if not v or v.strip() != v:
            raise ValueError('conv_id cannot have leading/trailing whitespace')
        return v.strip()

class ProcessingTask(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    _id: str = Field(...)
    conv_id: str = Field(...)
    status: ProcessingStatus = Field(default=ProcessingStatus.PENDING)
    progress: float = Field(default=0.0)
    error_message: Optional[str] = Field(default=None)
    result_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = Field(default=None)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class QAResponse(BaseModel):
    question: str
    answer: str
    created_at: str

class Question(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    _id: str = Field(...)
    question_text: str = Field(..., min_length=3, max_length=500)
    question_keywords: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class Conversation(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    _id: str = Field(...)
    conv_id: str = Field(...)
    conv_script: str = Field(...)
    processed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class QAPair(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    _id: str = Field(...)  # ADD THIS LINE
    conv_id: str = Field(...)
    question: str = Field(...)
    answer: str = Field(...)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}



