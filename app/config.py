#app/config.py

import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # Twilio Configuration
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
    TWILIO_API_KEY = os.getenv("TWILIO_API_KEY")
    TWILIO_API_SECRET = os.getenv("TWILIO_API_SECRET")
    TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
    TWILIO_APP_SID = os.getenv("TWILIO_APP_SID")
    
    # Application Configuration
    BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this")
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    
    # Queue Configuration
    QUEUE_NAME = "support-queue"
    
    @property
    def COMFORT_MESSAGE_URL(self):
        return f"{self.BASE_URL}/webhook/comfort-message"

settings = Settings()