from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging
from datetime import datetime, timezone
from twilio.rest import Client as TwilioClient
import json
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.api.models.ai_agent_model import Call, Agent, Organization, AIAgent, AICallLog

from app.core.config import settings
from app.core.redis_manager import RedisManager
from app.core.database_manager import DatabaseManager
from app.core.websocket_manager import WebSocketManager
from app.api.endpoints import call_routing
from app.core.metrics import update_metrics, get_metrics
from app.api.endpoints.real_agent_transfering_call import router
from app.services.shared_state import SharedState
from app.api.endpoints import ai_document
from app.api.endpoints import ai_voice
from app.api.endpoints import connect_ai_agent_with_twilio
from app.api.endpoints import ai_agent
from app.api.endpoints import ai_call_log_webhook


# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Health monitoring
class HealthStatus:
    def __init__(self):
        self.backend_healthy = True
        self.last_health_check = datetime.now(timezone.utc)
        self.consecutive_failures = 0
        self.max_failures = 5

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager with enhanced monitoring"""
    
    # Startup
    try:
        # Initialize managers
        shared_state = SharedState()
        shared_state.redis_manager = RedisManager(settings.REDIS_URL)
        await shared_state.redis_manager.initialize()
        
        shared_state.db_manager = DatabaseManager(settings.MONGODB_URL)
        await shared_state.db_manager.initialize()
        
        shared_state.websocket_manager = WebSocketManager(shared_state.redis_manager)
        await shared_state.websocket_manager.start_message_listener()
        
        # Initialize Twilio client
        shared_state.twilio_client = TwilioClient(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        
        # Initialize health status
        shared_state.health_status = HealthStatus()
        
        # Store shared state in app state
        app.state.shared_state = shared_state
        
        # Start background tasks
        asyncio.create_task(metrics_updater(shared_state))
        asyncio.create_task(health_monitor(shared_state))
        
        logger.info(f"Application started successfully on instance {settings.INSTANCE_ID}")

        client = AsyncIOMotorClient(settings.MONGODB_URL)
        # Initialize Beanie with all document models
        await init_beanie(
            database=client.get_database(settings.MONGO_DB_NAME),
            document_models=[Call, Agent, Organization, AIAgent, AICallLog],
            allow_index_dropping=True
        )
        logger.info("Beanie initialized with Call, Agent, Organization, AIAgent, and AICallLog models")
        
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        raise
    
    yield
    
    # Shutdown
    shared_state = app.state.shared_state
    if shared_state.websocket_manager:
        await shared_state.websocket_manager.stop_message_listener()
    if shared_state.redis_manager:
        await shared_state.redis_manager.close()
    if shared_state.db_manager:
        await shared_state.db_manager.close()
    
    logger.info("Application shutdown complete")

async def metrics_updater(shared_state: SharedState):
    """Periodically update metrics"""
    while True:
        try:
            await update_metrics(shared_state.redis_manager)
            await asyncio.sleep(60)
        except Exception as e:
            logger.error(f"Metrics update failed: {e}")
            await asyncio.sleep(120)

async def health_monitor(shared_state: SharedState):
    """Monitor backend health and update status"""
    
    while True:
        try:
            # Check Redis connection
            await shared_state.redis_manager.redis_client.ping()
            
            # Check MongoDB connection
            await shared_state.db_manager.client.admin.command('ping')
            
            # Check available agents
            agent_count = await shared_state.redis_manager.redis_client.scard("agents:free:global")
            
            # Update health status
            shared_state.health_status.backend_healthy = True
            shared_state.health_status.consecutive_failures = 0
            shared_state.health_status.last_health_check = datetime.now(timezone.utc)
            
            # Store health status in Redis for external monitoring
            await shared_state.redis_manager.redis_client.setex(
                f"health:{settings.INSTANCE_ID}",
                120,
                json.dumps({
                    "healthy": True,
                    "timestamp": shared_state.health_status.last_health_check.isoformat(),
                    "available_agents": agent_count,
                    "instance_id": settings.INSTANCE_ID
                })
            )
            
            logger.debug(f"Health check passed - Available agents: {agent_count}")
            
        except Exception as e:
            shared_state.health_status.consecutive_failures += 1
            logger.error(f"Health check failed: {e}")
            
            if shared_state.health_status.consecutive_failures >= shared_state.health_status.max_failures:
                shared_state.health_status.backend_healthy = False
                logger.critical("Backend marked as unhealthy due to consecutive failures")
        
        await asyncio.sleep(60)

# Create FastAPI app
app = FastAPI(
    title="Scalable Call Center Backend",
    description="High-performance call center system with Redis and WebSocket support",
    version="2.0.0",
    lifespan=lifespan
)

@app.get("/")
def home():
    # It's common practice for APIs to return JSON responses.
    # FastAPI automatically converts Python dicts to JSON.
    return {"message": "AI Server is ready to run...."}

# CORS middleware
origins = [
    "http://localhost:3000",
    # Add any other origins you need
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)
app.include_router(ai_document.router)
app.include_router(ai_voice.router)
app.include_router(call_routing.router)
app.include_router(connect_ai_agent_with_twilio.router)
app.include_router(ai_agent.router)
app.include_router(ai_call_log_webhook.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        port=9050, 
        workers=1,
        reload=True,
        log_level="info"
    )