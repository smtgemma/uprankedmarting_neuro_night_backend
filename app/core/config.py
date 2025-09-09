import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Twilio
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_API_KEY: str = os.getenv("TWILIO_API_KEY", "")
    TWILIO_API_SECRET: str = os.getenv("TWILIO_API_SECRET", "")
    TWILIO_APP_SID: str = os.getenv("TWILIO_APP_SID", "")

    # Elevenlabs
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY","")

    # Web hooks
    WEBHOOK_URL: str = os.getenv("WEBHOOK_URL", "")
    
    # Database
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://admin:password123@localhost:27017/callcenter?authSource=admin")
    MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "uprankedmartin-calling")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # JWT
    JWT_ACCESS_SECRET: str = os.getenv("JWT_ACCESS_SECRET", "your_login_server_jwt_secret_here")
    JWT_REFRESH_SECRET: str = os.getenv("JWT_REFRESH_SECRET", "kPzM8wLtYbNe5qRaDf9XvJhKiCG30AMuTrhWcs7yBoVxdQnE2LgFZSa1ipOmHTKU")
    JWT_ALGORITHM: str = "HS256"
    
    # Instance
    INSTANCE_ID: str = os.getenv("INSTANCE_ID", "1")

    BASE_URL: str = os.getenv("BASE_URL", "")
    HEALTH_CHECK_INTERVAL: int = 300
    MAX_CONSECUTIVE_FAILURES: int = 3
    WEBHOOK_TIMEOUT: int = 15
    
    class Config:
        env_file = ".env"

settings = Settings()