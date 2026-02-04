"""
Australian Name Capture Primitive (Layer 1)

Captures the caller's name and normalizes for storage:
- Handles first + last name or first name only
- Accepts spoken titles (Dr., Mr., Ms.)
- Confirms name with user per R-ARCH-006 for critical data
- Max 3 retries
"""

import json
import re
from typing import Optional, Dict, Any

from .base import BaseCaptureObjective


class CaptureNameAU(BaseCaptureObjective):
    """
    Capture first name (and optional last name) for Australian callers.
    """

    NAME_PATTERN = re.compile(
        r"(?:my name is|i'm|i am|this is|call me)\s+(?:dr\.?\s+|mr\.?\s+|mrs\.?\s+|ms\.?\s+)?"
        r"([a-zA-Z'-]{2,50})(?:\s+([a-zA-Z'-]{2,50}))?",
        re.IGNORECASE
    )
    SINGLE_NAME_PATTERN = re.compile(r"^[a-zA-Z'-]{2,50}$")

    def __init__(self, locale: str = "en-AU", max_retries: int = 3):
        super().__init__(
            objective_type="capture_name_au",
            locale=locale,
            is_critical=True,
            max_retries=max_retries
        )

    def get_elicitation_prompt(self) -> str:
        if self.state_machine.retry_count == 0:
            return "Can I please have your name?"
        elif self.state_machine.retry_count == 1:
            return "I didn't quite catch that. Could you say your name again?"
        else:
            return "Let's try one more time. Please say your name slowly and clearly."

    async def extract_value(self, transcription: str) -> Optional[Dict[str, Any]]:
        normalized = transcription.strip()
        match = self.NAME_PATTERN.search(normalized)
        if match:
            first_name = match.group(1).title()
            last_name = match.group(2).title() if match.group(2) else None
            return {"first_name": first_name, "last_name": last_name}

        words = normalized.split()
        if len(words) == 1 and self.SINGLE_NAME_PATTERN.match(words[0]):
            return {"first_name": words[0].title(), "last_name": None}

        return None

    async def validate_value(self, value: Dict[str, Any]) -> bool:
        first_name = value.get("first_name", "")
        last_name = value.get("last_name")

        if not first_name or not self.SINGLE_NAME_PATTERN.match(first_name):
            return False
        if last_name and not self.SINGLE_NAME_PATTERN.match(last_name):
            return False
        return True

    def get_confirmation_prompt(self, value: Dict[str, Any]) -> str:
        first_name = value["first_name"]
        last_name = value.get("last_name")
        if last_name:
            return f"Got it, {first_name} {last_name}. Is that correct?"
        return f"Got it, {first_name}. Is that correct?"

    def normalize_value(self, value: Dict[str, Any]) -> str:
        return json.dumps(value)

    async def is_affirmation(self, transcription: str) -> bool:
        text = transcription.lower()
        return any(keyword in text for keyword in ["yes", "correct", "that's right", "yep"])

    async def extract_correction(self, transcription: str) -> Optional[Dict[str, Any]]:
        return await self.extract_value(transcription)
