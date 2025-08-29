# services/qa_retrieval_service.py (Optimized for Database-First Approach)
from typing import List, Dict, Any
from fastapi import HTTPException
import logging

from api.models import QAResponse

logger = logging.getLogger(__name__)

class QARetrievalService:
    def __init__(self, db):
        self.db = db
    
    async def get_qa_pairs(self, _id: str, conv_id: str) -> List[QAResponse]:
        """Retrieve Q&A pairs directly from database"""
        try:
            # Verify organization exists
            org = await self.db.organizations.find_one({"_id": _id, "is_active": True})
            if not org:
                raise HTTPException(status_code=404, detail="Organization not found")
            
            # Verify conversation exists and belongs to organization
            conversation = await self.db.conversations.find_one({"conv_id": conv_id, "_id": _id})
            if not conversation:
                raise HTTPException(status_code=404, detail="Conversation not found for this organization")
            
            qa_pairs_cursor = self.db.qa_pairs.find({"conv_id": conv_id, "_id": _id}).sort("created_at", -1)
            qa_pairs = await qa_pairs_cursor.to_list(length=None)
            
            if not qa_pairs:
                raise HTTPException(status_code=404, detail="No Q&A pairs found")
            # Format response without caching the actual data
            response = []
            for qa in qa_pairs:
                response.append(QAResponse(
                    question=qa["question"],
                    answer=qa["answer"],
                    created_at=qa["created_at"].isoformat()
                ))
            
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving Q&A pairs: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to retrieve Q&A pairs")
    
    async def get_qa_pairs_paginated(self, conv_id: str, page: int = 1, page_size: int = 50) -> Dict[str, Any]:
        """Get Q&A pairs with pagination for better memory management"""
        try:
            # Check if conversation exists
            conversation = await self.db.conversations.find_one({"conv_id": conv_id})
            if not conversation:
                raise HTTPException(status_code=404, detail="Conversation not found")
            
            # Calculate skip and limit
            skip = (page - 1) * page_size
            
            # Get paginated Q&A pairs
            qa_pairs_cursor = (self.db.qa_pairs
                              .find({"conv_id": conv_id})
                              .sort("created_at", -1)
                              .skip(skip)
                              .limit(page_size))
            
            qa_pairs = await qa_pairs_cursor.to_list(length=None)
            
            # Get total count
            total_count = await self.db.qa_pairs.count_documents({"conv_id": conv_id})
            
            # Format response
            response_data = []
            for qa in qa_pairs:
                response_data.append({
                    "question": qa["question"],
                    "answer": qa["answer"],
                    "created_at": qa["created_at"].isoformat()
                })
            
            return {
                "qa_pairs": response_data,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total_count": total_count,
                    "total_pages": (total_count + page_size - 1) // page_size,
                    "has_next": skip + page_size < total_count,
                    "has_prev": page > 1
                }
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving paginated Q&A pairs: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to retrieve Q&A pairs")


