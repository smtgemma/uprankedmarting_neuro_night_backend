# services/conversation_processing_service.py (Memory Optimized)
from typing import Dict, Any
from bson import ObjectId
from fastapi import HTTPException
import asyncio
import logging
from datetime import datetime

from api.models import Conversation, ConversationCreate, QAPair, ProcessingTask, ProcessingStatus
from services.ai_llm import AIService
from services.rag_services import RAGService

logger = logging.getLogger(__name__)

class ConversationProcessingService:
    def __init__(self, db):
        self.db = db
        self.org_id = None
        self.ai_service = AIService()
        self.rag_service = RAGService()
        self.max_concurrent_tasks = 5  # Reduced for memory efficiency
        self.processing_semaphore = asyncio.Semaphore(self.max_concurrent_tasks)
    
    async def start_async_processing(self, org_id: str, conversation_data: ConversationCreate) -> str:
        """Start asynchronous conversation processing"""
        try:
            # Verify organization exists
            org = await self.db.organizations.find_one({"org_id": org_id, "is_active": True})
            if not org:
                raise HTTPException(status_code=404, detail="Active organization not found")
            
            # Check for duplicate conversation
            existing_conv = await self.db.conversations.find_one({
                "org_id": org_id,
                "conv_id": conversation_data.conv_id
            })
            if existing_conv:
                raise HTTPException(status_code=400, detail="Conversation already exists")
            
            # Create processing task
            task = ProcessingTask(
                org_id=org_id,
                conv_id=conversation_data.conv_id,
                status=ProcessingStatus.PENDING
            )
            task_dict = task.dict(by_alias=True)
            result = await self.db.processing_tasks.insert_one(task_dict)
            task_id = task.task_id
            
            # Create conversation record
            conversation = Conversation(
                org_id=org_id,
                conv_id=conversation_data.conv_id,
                conv_script=conversation_data.conv_script
            )
            conv_dict = conversation.dict(by_alias=True)
            await self.db.conversations.insert_one(conv_dict)
            
            # Start background processing
            asyncio.create_task(self._process_conversation_background(task_id, org_id, conversation_data))
            
            return task_id
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error starting conversation processing: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to start processing")
    
    async def _process_conversation_background(self, task_id: str, org_id: str, conversation_data: ConversationCreate):
        self.org_id = org_id
        """Background task for processing conversation - Memory optimized"""
        # Add conversation-level locking for data flow security
        conversation_lock_key = f"conv_processing_{conversation_data.conv_id}"
        
        async with self.processing_semaphore:
            try:
                # Prevent concurrent processing of same conversation
                existing_task = await self.db.processing_tasks.find_one({
                    "conv_id": conversation_data.conv_id,
                    "status": {"$in": ["pending", "in_progress"]}
                })
                if existing_task and existing_task["task_id"] != task_id:
                    raise ValueError("Conversation is already being processed")
                
                # Update task status to in_progress
                await self._update_task_status(task_id, ProcessingStatus.IN_PROGRESS, 0.0)
                
                # Store in vector database
                await self.rag_service.store_conversation(
                    conversation_data.conv_id,
                    conversation_data.conv_script
                )
                await self._update_task_status(task_id, ProcessingStatus.IN_PROGRESS, 20.0)
                
                # Get questions in small batches to save memory
                questions_cursor = self.db.questions.find({"org_id": org_id})
                
                processed_count = 0
                total_processed = 0
                batch_size = 3  # Smaller batches for memory efficiency
                current_batch = []
                
                async for question in questions_cursor:
                    current_batch.append(question)
                    
                    if len(current_batch) >= batch_size:
                        batch_count = await self._process_question_batch(
                            conversation_data.conv_id, 
                            current_batch,
                            task_id
                        )
                        processed_count += batch_count
                        total_processed += len(current_batch)
                        
                        # Update progress
                        progress = 20.0 + (70.0 * total_processed / await self._get_question_count(org_id))
                        await self._update_task_status(task_id, ProcessingStatus.IN_PROGRESS, min(progress, 99.0))
                        
                        # Clear batch to free memory
                        current_batch = []
                        
                        # Small delay to prevent overwhelming the system
                        await asyncio.sleep(0.1)
                
                # Process remaining questions
                if current_batch:
                    batch_count = await self._process_question_batch(
                        conversation_data.conv_id, 
                        current_batch,
                        task_id
                    )
                    processed_count += batch_count
                
                # Mark conversation as processed
                await self.db.conversations.update_one(
                    {"conv_id": conversation_data.conv_id},
                    {"$set": {"processed": True}}
                )
                
                # Complete task
                await self._update_task_status(
                    task_id, 
                    ProcessingStatus.COMPLETED, 
                    100.0,
                    result_count=processed_count
                )
                
            except Exception as e:
                logger.error(f"Background processing failed for task {task_id}: {e}")
                await self._update_task_status(
                    task_id, 
                    ProcessingStatus.FAILED, 
                    0.0, 
                    f"Processing failed: {str(e)}"
                )
    
    async def _process_question_batch(self, conv_id: str, questions: list, task_id: str) -> int:
        """Process a batch of questions and immediately store results"""
        processed_count = 0
        
        # Process questions in batch concurrently but store immediately
        tasks = []
        for question in questions:
            task = self._process_single_question_safe(conv_id, question)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Immediately store valid results to database (memory efficient)
        qa_pairs_to_insert = []
        for result in results:
            if not isinstance(result, Exception) and result:
                qa_pair = QAPair(
                    org_id=self.org_id,
                    conv_id=conv_id,
                    question=result["question"],
                    answer=result["answer"]
                )
                qa_pairs_to_insert.append(qa_pair.dict(by_alias=True))
                processed_count += 1
        
        # Bulk insert for efficiency
        if qa_pairs_to_insert:
            await self.db.qa_pairs.insert_many(qa_pairs_to_insert)
        
        return processed_count
    
    async def _get_question_count(self, org_id: str) -> int:
        """Get total question count for progress calculation"""
        return await self.db.questions.count_documents({"org_id": org_id})
    
    async def _process_single_question_safe(self, conv_id: str, question: Dict) -> Dict[str, Any]:
        """Safely process a single question with error handling"""
        try:
            extraction_result = await self.rag_service.extract_answer(
                conversation_id=conv_id,
                question=question["question_text"],
                question_lead=question.get("question_keywords", [])
            )
            
            return {
                "question": question["question_text"],
                "answer": extraction_result["answer"]
            }
        except Exception as e:
            logger.error(f"Error processing question '{question['question_text']}': {e}")
            return None
    
    async def _update_task_status(self, task_id: str, status: ProcessingStatus, progress: float, 
                                error_message: str = None, result_count: int = None):
        """Update processing task status"""
        update_data = {
            "status": status.value,
            "progress": progress
        }
        
        if error_message:
            update_data["error_message"] = error_message
        
        if result_count is not None:
            update_data["result_count"] = result_count
        
        if status == ProcessingStatus.COMPLETED:
            update_data["completed_at"] = datetime.utcnow()
        
        await self.db.processing_tasks.update_one(
            {"task_id": task_id},
            {"$set": update_data}
        )
    
    async def get_processing_status(self, task_id: str) -> Dict[str, Any]:
        """Get processing status for a task"""
        try:
            task = await self.db.processing_tasks.find_one({"task_id": task_id})
            if not task:
                raise HTTPException(status_code=404, detail="Task not found")
            
            response = {
                "task_id": task_id,
                "status": task["status"],
                "progress": task["progress"],
                "org_id": task["org_id"],
                "conv_id": task["conv_id"],
                "created_at": task["created_at"].isoformat()
            }
            
            if task.get("error_message"):
                response["error_message"] = task["error_message"]
            
            if task.get("completed_at"):
                response["completed_at"] = task["completed_at"].isoformat()
                response["result_count"] = task.get("result_count", 0)
            
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting task status: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to get task status")
			
			


