from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import IndexModel
from bson import ObjectId
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self, mongodb_url: str):
        self.mongodb_url = mongodb_url
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None
    
    async def initialize(self):
        """Initialize MongoDB connection with proper configuration"""
        try:
            self.client = AsyncIOMotorClient(
                self.mongodb_url,
                maxPoolSize=50,
                minPoolSize=10,
                maxIdleTimeMS=30000,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000,
                socketTimeoutMS=20000
            )
            
            # Get database name from URL
            db_name = "uprankedmartin-calling"
            self.db = self.client[db_name]
            
            # Test connection
            await self.client.admin.command('ping')
            logger.info("MongoDB connection established successfully")
            
            # Ensure indexes
            await self.ensure_indexes()
            
        except Exception as e:
            logger.error(f"Failed to initialize MongoDB: {e}")
            raise
    
    async def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
    
    async def ensure_indexes(self):
        """Ensure all required indexes exist"""
        try:
            # Agents collection indexes
            await self.db.agents.create_indexes([
                IndexModel([("userId", 1)], unique=True, name="agents_userId_key"),
                IndexModel([("status", 1)]),
                IndexModel([("sip_username", 1)]),
                IndexModel([("assignTo", 1)]),
                IndexModel([("last_activity", 1)])
            ])
            
            # Subscriptions collection indexes
            await self.db.subscriptions.create_indexes([
                IndexModel([("purchasedNumber", 1)]),
                IndexModel([("organizationId", 1)]),
                IndexModel([("status", 1)]),
                IndexModel([("purchasedNumber", 1), ("status", 1)])
            ])
            
            # Call logs collection indexes (for future use)
            await self.db.call_logs.create_indexes([
                IndexModel([("call_id", 1)], unique=True),
                IndexModel([("agent_id", 1)]),
                IndexModel([("start_time", 1)]),
                IndexModel([("organization_id", 1)]),
                IndexModel([("status", 1)])
            ])
            
            logger.info("Database indexes created successfully")
            
        except Exception as e:
            logger.error(f"Failed to create indexes: {e}")
            raise