from twilio.rest import Client
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from twilio.twiml.voice_response import VoiceResponse
from app.config import settings
from typing import Optional

class TwilioService:
    def __init__(self):
        self.debug_credentials()
        self.client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        self.app_sid = self.ensure_twiml_app_exists()  # Add this line
        self.ensure_queue_exists()
    
    def ensure_queue_exists(self):
        """Ensure the support queue exists"""
        try:
            # Try to fetch the queue
            self.client.queues(settings.QUEUE_NAME).fetch()
            print(f"Queue {settings.QUEUE_NAME} already exists")
        except Exception:
            # Queue doesn't exist, create it
            try:
                self.client.queues.create(
                    friendly_name=settings.QUEUE_NAME,
                    max_size=100
                )
                print(f"Created queue: {settings.QUEUE_NAME}")
            except Exception as e:
                print(f"Error creating queue: {e}")
                
    def ensure_twiml_app_exists(self):
        """Ensure TwiML application exists for WebRTC"""
        try:
            # Try to fetch existing app
            if settings.TWILIO_APP_SID:
                app = self.client.applications(settings.TWILIO_APP_SID).fetch()
                print(f"Using existing TwiML App: {app.sid}")
                return app.sid
        except Exception:
            pass
        
        # Create new TwiML application
        try:
            app = self.client.applications.create(
                friendly_name="Call Center WebRTC App",
                voice_url=f"{settings.BASE_URL}/webhook/incoming-call",
                voice_method="POST"
            )
            print(f"Created TwiML App: {app.sid}")
            print(f"Add this to your .env file: TWILIO_APP_SID={app.sid}")
            return app.sid
        except Exception as e:
            print(f"Error creating TwiML app: {e}")
            return None
    
    def generate_access_token(self, identity: str) -> str:
        """Generate access token for WebRTC client"""
        # Use the app SID we created/found
        app_sid = self.app_sid or settings.TWILIO_APP_SID
        
        if not app_sid:
            raise Exception("No TwiML Application SID available")
        
        # Create access token
        token = AccessToken(
            settings.TWILIO_ACCOUNT_SID,
            settings.TWILIO_API_KEY,
            settings.TWILIO_API_SECRET,
            identity=identity,
            ttl=3600
        )
        
        # Add Voice grant
        voice_grant = VoiceGrant(
            incoming_allow=True,
            outgoing_application_sid=app_sid
        )
        token.add_grant(voice_grant)
        
        return token.to_jwt()
    
    def create_incoming_call_twiml(self) -> str:
        """Create TwiML for incoming calls - enqueue them"""
        response = VoiceResponse()
        response.say("Welcome to our support line. Please hold while we connect you to an agent.",
                    voice='alice')
        
        # Simple enqueue without complex callbacks that might fail
        response.enqueue(settings.QUEUE_NAME)
        
        return str(response)

    def create_comfort_message_twiml(self) -> str:
        """Create TwiML for comfort message while waiting"""
        response = VoiceResponse()
        response.say("Thank you for holding. An agent will be with you shortly.",
                    voice='alice')
        response.pause(length=10)
        
        return str(response)
    
    def dequeue_call(self, call_sid: str, agent_identity: str) -> bool:
        """Dequeue a caller and connect to agent"""
        try:
            # Update the call to dequeue and connect to agent
            call = self.client.calls(call_sid).update(
                method='POST',
                url=f"{settings.BASE_URL}/webhook/connect-agent/{agent_identity}"
            )
            return True
        except Exception as e:
            print(f"Error dequeuing call: {e}")
            return False
    
    def create_agent_connection_twiml(self, agent_identity: str) -> str:
        """Create TwiML to connect caller to agent via WebRTC"""
        response = VoiceResponse()
        
        # Add status callback to track connection
        dial = response.dial(
            timeout=30,
            action=f"{settings.BASE_URL}/webhook/dial-status",
            method='POST'
        )
        
        # Connect to the agent's WebRTC client
        dial.client(
            agent_identity,
            status_callback=f"{settings.BASE_URL}/webhook/client-status",
            status_callback_method='POST'
        )
        
        # Fallback if connection fails
        response.say("Sorry, the agent is not available. Please try again later.", voice='alice')
        
        return str(response)
    
    def get_queue_statistics(self) -> dict:
        """Get current queue statistics"""
        try:
            queue = self.client.queues(settings.QUEUE_NAME).fetch()
            return {
                "current_size": queue.current_size,
                "max_size": queue.max_size,
                "average_wait_time": queue.average_wait_time
            }
        except Exception as e:
            print(f"Error fetching queue stats: {e}")
            return {"current_size": 0, "max_size": 0, "average_wait_time": 0}
    def debug_credentials(self):
        """Debug Twilio credentials"""
        print("=== TWILIO CREDENTIALS DEBUG ===")
        print(f"Account SID: {settings.TWILIO_ACCOUNT_SID[:10]}..." if settings.TWILIO_ACCOUNT_SID else "Account SID: MISSING")
        print(f"Auth Token: {settings.TWILIO_AUTH_TOKEN[:10]}..." if settings.TWILIO_AUTH_TOKEN else "Auth Token: MISSING")
        print(f"API Key: {settings.TWILIO_API_KEY[:10]}..." if settings.TWILIO_API_KEY else "API Key: MISSING")
        print(f"API Secret: {settings.TWILIO_API_SECRET[:10]}..." if settings.TWILIO_API_SECRET else "API Secret: MISSING")
        print(f"App SID: {settings.TWILIO_APP_SID}" if settings.TWILIO_APP_SID else "App SID: MISSING")
        print("================================")

twilio_service = TwilioService()

