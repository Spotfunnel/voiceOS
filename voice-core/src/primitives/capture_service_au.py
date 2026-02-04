"""
Australian Service Capture Primitive (Layer 1)

Selects the service the caller needs from the tenant catalog.
Uses keyword matching for services and disambiguates when multiple
services match an utterance.
"""

import json
from typing import Optional, Dict, Any, List

from .base import BaseCaptureObjective


class CaptureServiceAU(BaseCaptureObjective):
    """
    Captures tenant service selection using keyword matching.
    """

    def __init__(
        self,
        service_catalog: List[Dict[str, Any]],
        locale: str = "en-AU",
        max_retries: int = 3
    ):
        super().__init__(
            objective_type="capture_service_au",
            locale=locale,
            is_critical=False,
            max_retries=max_retries
        )
        self.service_catalog = service_catalog
        self._last_matches: List[Dict[str, Any]] = []

    def get_elicitation_prompt(self) -> str:
        if self.state_machine.retry_count == 0:
            return "What service are you looking for today?"
        elif self.state_machine.retry_count == 1:
            return "Could you tell me which service you need again?"
        else:
            return "Please say the service you need, such as plumbing or electrical."

    async def extract_value(self, transcription: str) -> Optional[Dict[str, Any]]:
        utterance = transcription.lower()
        matches = []

        for service in self.service_catalog:
            for keyword in service.get("keywords", []):
                if keyword.lower() in utterance:
                    matches.append(service)
                    break

        self._last_matches = matches

        if len(matches) == 1:
            service = matches[0]
            return {"service_id": service["id"], "service_name": service["name"]}

        return None

    async def validate_value(self, value: Dict[str, Any]) -> bool:
        service_id = value.get("service_id")
        return any(s["id"] == service_id for s in self.service_catalog)

    def get_confirmation_prompt(self, value: Dict[str, Any]) -> str:
        service_name = value["service_name"]
        return f"Okay, you're looking for {service_name}. Is that right?"

    def normalize_value(self, value: Dict[str, Any]) -> str:
        return json.dumps(value)

    async def is_affirmation(self, transcription: str) -> bool:
        text = transcription.lower()
        return any(keyword in text for keyword in ["yes", "correct", "right", "that is right", "yep"])

    async def extract_correction(self, transcription: str) -> Optional[Dict[str, Any]]:
        return await self.extract_value(transcription)

    def get_disambiguation_prompt(self) -> Optional[str]:
        if len(self._last_matches) <= 1:
            return None
        names = [service["name"] for service in self._last_matches[:3]]
        if len(names) == 2:
            return f"Are you looking for {names[0]} or {names[1]}?"
        return f"Are you looking for {', '.join(names[:-1])}, or {names[-1]}?"
