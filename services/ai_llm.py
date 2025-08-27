# services/ai_llm.py

from openai import AsyncOpenAI
from typing import List, Dict, Any
from core.config import settings
import logging

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        if not settings.OPENAI_API_KEY:
            raise ValueError("OpenAI API key not provided")
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY,timeout=60.0)

    async def chat_completion(
        self, 
        messages: List[Dict[str, str]], 
        model: str = settings.OPENAI_MODEL,
        temperature: float = 0.0
    ) -> str:
        """
        Perform a chat completion call using OpenAI's API.
        """
        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=1000
                # timeout=30.0
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return ""

    async def question_ai_validation_check(
        self,
        organization_name: str,
        new_question: str,
        existing_questions: str
    ) -> List[str]:
        """
        Checks whether a new question already exists in a given list of existing questions,
        and extracts key terms if it's new and relevant to questions a call center agent might ask a caller.

        Returns:
            - ["0"] if the question already exists
            - ["Provide a relevant Question"] if irrelevant
            - [keyword1, keyword2, ...] otherwise
        """

        system_prompt = (
            "You are a helpful assistant for call center question validation. Follow these steps in order:"
            "\n\n"
            "Step 1: Check if existing questions list is empty or contains meaningful questions\n"
            "Step 2: If there are existing questions, check if the new question is similar to any of them\n" 
            "Step 3: If similar, respond with: '0'\n"
            "Step 4: If not similar OR no existing questions, check if the new question is relevant to questions a call center agent might ask a caller for the mentioned organization's call center operations. A question is relevant if it pertains to any aspect of agent-caller interactions, including but not limited to verifying caller identity, gathering information, addressing inquiries, processing requests, or managing issues related to the organization's services or workflows\n"
            "Step 5: If completely unrelated to questions an agent might ask a caller in the organization's call center, respond with: 'Provide a relevant Question'\n"
            "Step 6: Otherwise, extract keywords (underscore_separated if multi-word) from the new question and return the extracted keywords only, nothing else.\n"
        )

        user_prompt = (
            f"Organization: {organization_name}\n\n"
            f"New question: {new_question}\n\n"
            f"Existing questions: '{existing_questions}'\n\n"
            "Follow the steps:\n"
            "1. Are there meaningful existing questions? (ignore if empty/whitespace)\n"
            "2. If yes, is the new question similar to any existing question?\n"
            "3. If similar, return '0'\n" 
            "4. If not similar or no existing questions, is this new question relevant to questions a call center agent of that organization might ask a caller in the organization's call center (e.g., verifying caller identity, gathering information, addressing inquiries, processing requests, or managing issues related to the organization's services or workflows)?\n"
            "5. If irrelevant, return 'Provide a relevant Question'\n"
            "6. Otherwise, extract key terms from the new question and return the extracted keywords (underscore_separated if multi-word) only, nothing else."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        response = await self.chat_completion(messages)

        if response.strip() in ["0", "Provide a relevant Question"]:
            return [response.strip()]

        return [kw.strip() for kw in response.split(",") if kw.strip()]
    