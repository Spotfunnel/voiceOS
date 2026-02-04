"""
FAQ Handler Primitive (Layer 1)

Matches user questions to FAQ answers and optionally escalates.
This primitive is non-critical (no mandatory confirmation) and
returns a canned response or escalation prompt.
"""

from typing import Optional, Dict, Any, List

from .base import BaseCaptureObjective


class FAQHandlerAU(BaseCaptureObjective):
    """
    Stateless FAQ handler that returns matching FAQ answers.
    """

    def __init__(
        self,
        faq_knowledge_base: List[Dict[str, Any]],
        locale: str = "en-AU",
        max_retries: int = 1
    ):
        super().__init__(
            objective_type="faq_handler_au",
            locale=locale,
            is_critical=False,
            max_retries=max_retries
        )
        self.faq_knowledge_base = faq_knowledge_base

    def get_elicitation_prompt(self) -> str:
        return "How can I help you today?"

    async def extract_value(self, transcription: str) -> Optional[str]:
        utterance = transcription.lower()
        for faq in self.faq_knowledge_base:
            for keyword in faq.get("keywords", []):
                if keyword.lower() in utterance:
                    return faq["answer"]
        return None

    async def validate_value(self, value: str) -> bool:
        return bool(value)

    def get_confirmation_prompt(self, value: str) -> str:
        return f"{value} Let me know if you need anything else."

    def normalize_value(self, value: str) -> str:
        return value

    async def is_affirmation(self, transcription: str) -> bool:
        text = transcription.lower()
        return any(word in text for word in ["yes", "thanks", "thank you", "done"])

    async def extract_correction(self, transcription: str) -> Optional[str]:
        return await self.extract_value(transcription)
