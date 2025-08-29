#app/utils/auth.py

import secrets
import hashlib
from typing import Optional

class AuthUtils:
    @staticmethod
    def generate_agent_token() -> str:
        """Generate a secure token for agent sessions"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def hash_agent_id(agent_id: str) -> str:
        """Hash agent ID for security"""
        return hashlib.sha256(agent_id.encode()).hexdigest()[:16]
    
    @staticmethod
    def validate_agent_credentials(agent_id: str, agent_name: str) -> bool:
        """Basic validation for agent credentials"""
        if not agent_id or not agent_name:
            return False
        if len(agent_id) < 3 or len(agent_name) < 2:
            return False
        return True

auth_utils = AuthUtils()
