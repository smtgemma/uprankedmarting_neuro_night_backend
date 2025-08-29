# api/endpoints.py 
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import Dict, Any, List
import asyncio
from contextlib import asynccontextmanager
import logging

from api.models import (
    ConversationCreate, QAResponse,
    Organization, Question, SingleQuestionCreate, QuestionUpdate
)
from core.database import get_database
from core.rate_limiter import RateLimiter
from core.circuit_breaker import CircuitBreaker
from services.ai_llm import AIService
from services.conversation_processing_service import ConversationProcessingService
from services.qa_retrieval_service import QARetrievalService

router = APIRouter()
logger = logging.getLogger(__name__)

# Rate limiter and circuit breaker instances
rate_limiter = RateLimiter(requests_per_minute=100)
circuit_breaker = CircuitBreaker(failure_threshold=5, timeout=60)


@router.post("/organizations/{_id}/questions", response_model=Dict[str, Any])
async def add_single_question(
    _id: str,
    question_data: SingleQuestionCreate,
    db=Depends(get_database)
):
    """Add a single question to an organization"""
    async with rate_limiter.acquire(f"question_{_id}"):
        async with circuit_breaker.call():
            
            # Validate _id matches
            if question_data._id != _id:
                raise HTTPException(status_code=400, detail="_id in URL does not match _id in request body")
            
            # Create organization if it doesn't exist
            existing_org = await db.organizations.find_one({"_id": _id, "is_active": True})
            org_created = False
            if not existing_org:
                organization = Organization(
                    _id=question_data._id,
                    name=question_data.name
                )
                await db.organizations.insert_one(organization.dict(by_alias=True))
                org_created = True
                existing_org = {"name": question_data.name, "_id": _id}
            
            # Get existing questions for AI validation
            existing_questions = await db.questions.find({"_id": _id}).to_list(length=None)
            existing_text = " ".join([q["question_text"] for q in existing_questions])
            
            # AI validation
            ai_service = AIService()
            validation_result = await ai_service.question_ai_validation_check(
                existing_org["name"], 
                question_data.question, 
                existing_text
            )
            
            if validation_result[0] == 'Provide a relevant Question':
                return {
                    "accepted": False, 
                    "reason": "Not relevant to call center operations",
                    "question": question_data.question,
                    "_id": _id,
                    "org_created": org_created
                }
            elif validation_result[0] == '0':
                return {
                    "accepted": False, 
                    "reason": "Similar question already exists",
                    "question": question_data.question,
                    "_id": _id,
                    "org_created": org_created
                }
            else:
                # Save question
                question = Question(
                    _id=_id,
                    question_text=question_data.question,
                    question_keywords=validation_result
                )
                q_result = await db.questions.insert_one(question.dict(by_alias=True))
                
                return {
                    "accepted": True,
                    "question_id": str(q_result.inserted_id),
                    "question": question_data.question,
                    "keywords": validation_result,
                    "_id": _id,
                    "org_created": org_created,
                    "message": f"Question added successfully{' (Organization created)' if org_created else ''}"
                }

@router.delete("/organizations/{_id}/questions/{question_id}", response_model=Dict[str, Any])
async def delete_question(
    _id: str,
    question_id: str,
    db=Depends(get_database)
):
    """Delete a question from an organization"""
    async with rate_limiter.acquire(f"question_delete_{_id}_{question_id}"):
        from bson import ObjectId
        
        # Validate question_id format
        try:
            question_obj_id = ObjectId(question_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid question_id format")
        
        # Check if question exists and belongs to the organization
        question = await db.questions.find_one({
            "_id": question_obj_id,
            "_id": _id
        })
        
        if not question:
            raise HTTPException(status_code=404, detail="Question not found or doesn't belong to this organization")
        
        # Delete the question
        result = await db.questions.delete_one({
            "_id": question_obj_id,
            "_id": _id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Question not found")
        
        return {
            "message": "Question deleted successfully",
            "question_id": question_id,
            "_id": _id,
            "deleted_question": question["question_text"]
        }

@router.put("/organizations/{_id}/questions/{question_id}", response_model=Dict[str, Any])
async def update_question(
    _id: str,
    question_id: str,
    question_update: QuestionUpdate,
    db=Depends(get_database)
):
    """Update a question for an organization with AI validation"""
    async with rate_limiter.acquire(f"question_update_{_id}_{question_id}"):
        async with circuit_breaker.call():
            from bson import ObjectId
            
            # Validate question_id format
            try:
                question_obj_id = ObjectId(question_id)
            except:
                raise HTTPException(status_code=400, detail="Invalid question_id format")
            
            # Check if question exists and belongs to the organization
            existing_question = await db.questions.find_one({
                "_id": question_obj_id,
                "_id": _id
            })
            
            if not existing_question:
                raise HTTPException(status_code=404, detail="Question not found or doesn't belong to this organization")
            
            # Get organization info
            org = await db.organizations.find_one({"_id": _id, "is_active": True})
            if not org:
                raise HTTPException(status_code=404, detail="Organization not found")
            
            # Get existing questions excluding the current one for validation
            other_questions = await db.questions.find({
                "_id": _id,
                "_id": {"$ne": question_obj_id}
            }).to_list(length=None)
            existing_text = " ".join([q["question_text"] for q in other_questions])
            
            # AI validation
            ai_service = AIService()
            validation_result = await ai_service.question_ai_validation_check(
                org["name"], 
                question_update.question, 
                existing_text
            )
            
            if validation_result[0] == 'Provide a relevant Question':
                return {
                    "accepted": False, 
                    "reason": "Not relevant to call center operations",
                    "question": question_update.question,
                    "_id": _id,
                    "question_id": question_id,
                    "original_question": existing_question["question_text"]
                }
            elif validation_result[0] == '0':
                return {
                    "accepted": False, 
                    "reason": "Similar question already exists",
                    "question": question_update.question,
                    "_id": _id,
                    "question_id": question_id,
                    "original_question": existing_question["question_text"]
                }
            else:
                # Update question
                from datetime import datetime
                update_result = await db.questions.update_one(
                    {"_id": question_obj_id, "_id": _id},
                    {
                        "$set": {
                            "question_text": question_update.question,
                            "question_keywords": validation_result,
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                
                if update_result.modified_count == 0:
                    raise HTTPException(status_code=404, detail="Question not found")
                
                return {
                    "accepted": True,
                    "question_id": question_id,
                    "original_question": existing_question["question_text"],
                    "updated_question": question_update.question,
                    "keywords": validation_result,
                    "_id": _id,
                    "message": "Question updated successfully"
                }





@router.get("/organizations/{_id}/questions", response_model=List[Dict[str, Any]])
async def get_organization_questions(
    _id: str,
    db=Depends(get_database)
):
    """Get all questions for an organization"""
    async with rate_limiter.acquire(f"questions_get_{_id}"):
        # Check if organization exists
        org = await db.organizations.find_one({"_id": _id, "is_active": True})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Get questions
        questions = await db.questions.find({"_id": _id}).to_list(length=None)
        
        return [
            {
                "question_id": str(q["_id"]),
                "question_text": q["question_text"],
                "question_keywords": q.get("question_keywords", []),
                "created_at": q["created_at"].isoformat(),
                "updated_at": q.get("updated_at").isoformat() if q.get("updated_at") else None
            }
            for q in questions
        ]

@router.post("/organizations/{_id}/conversations/upload", response_model=Dict[str, Any])
async def process_conversation_file(
    _id: str,
    conv_id: str = Form(...),
    conversation_file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db=Depends(get_database)
):
    """Process conversation from uploaded text file - Async Processing"""
    async with rate_limiter.acquire(f"conv_file_process_{_id}_{conv_id}"):
        
        # Validate file type
        if not conversation_file.filename.endswith('.txt'):
            raise HTTPException(status_code=400, detail="Only .txt files are allowed")
        
        # Validate file size (10MB limit)
        MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
        content = await conversation_file.read()
        
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB")
        
        # Decode file content
        try:
            conv_script = content.decode('utf-8')
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="File must be UTF-8 encoded text")
        
        
        # Create ConversationCreate object
        conversation_data = ConversationCreate(
            conv_id=conv_id,
            conv_script=conv_script.strip()
        )
        
        # Process using existing service
        processing_service = ConversationProcessingService(db)
        task_id = await processing_service.start_async_processing(_id, conversation_data)
        
        return {
            "task_id": task_id,
            "conv_id": conv_id,
            "_id": _id,
            "status": "processing",
            "message": "Conversation file processing started. Use task_id to check status.",
            "check_status_endpoint": f"/api/v1/tasks/{task_id}/status",
            "file_info": {
                "filename": conversation_file.filename,
                "size_bytes": len(content),
                "content_length": len(conv_script.strip())
            }
        }

@router.get("/tasks/{task_id}/status")
async def get_processing_status(task_id: str, db=Depends(get_database)):
    """Check processing status of a conversation"""
    processing_service = ConversationProcessingService(db)
    return await processing_service.get_processing_status(task_id)

@router.get("/organizations/{_id}/conversations/{conv_id}/qa-pairs", response_model=List[QAResponse])
async def get_qa_pairs(_id: str, conv_id: str, db=Depends(get_database)):
   """Get question-answer pairs for a conversation"""
   async with rate_limiter.acquire(f"qa_get_{_id}_{conv_id}"):
       qa_service = QARetrievalService(db)
       return await qa_service.get_qa_pairs(_id, conv_id)
   