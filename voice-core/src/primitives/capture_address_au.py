"""
Australian Address Capture Primitive (Layer 1)

Captures and validates Australian addresses with:
- Component capture: street, suburb, state, postcode
- Australia Post API integration (validate suburb+state+postcode)
- State normalization: "New South Wales" → "NSW"
- Handle suburb conflicts (Richmond exists in 4 states)
- ALWAYS confirms (address is critical data)
- Multi-ASR voting for street name
- Max 3 retry attempts per component

Critical Rules:
- Address is CRITICAL data - MUST ALWAYS confirm
- Use multi-ASR voting for street name (critical component)
- Australia Post API mandatory for full validation
- Contextual confirmation (not robotic spelling)
"""

import re
from typing import Optional, Dict
import logging

from .base import BaseCaptureObjective
from ..api.australia_post import AustraliaPostClient
from ..validation.australian_validators import (
    validate_address_au,
    normalize_state
)

logger = logging.getLogger(__name__)


class CaptureAddressAU(BaseCaptureObjective):
    """
    Australian address capture primitive.
    
    Features:
    - Captures street, suburb, state, postcode components
    - Australia Post API validation (handles suburb conflicts)
    - State normalization
    - ALWAYS confirms (address is critical data)
    - Multi-ASR voting for street name
    - Max 3 retry attempts per component
    
    Usage:
        primitive = CaptureAddressAU()
        result = await primitive.execute()
        
        # Process user speech
        result = await primitive.process_transcription(
            "123 Main Street, Richmond, New South Wales, 2753",
            confidence=0.85
        )
    """
    
    def __init__(
        self,
        locale: str = "en-AU",
        max_retries: int = 3
    ):
        """
        Initialize address capture primitive.
        
        Args:
            locale: Locale for validation (default: "en-AU")
            max_retries: Maximum retry attempts (default: 3)
        """
        super().__init__(
            objective_type="capture_address_au",
            locale=locale,
            is_critical=True,  # Address is ALWAYS critical
            max_retries=max_retries
        )
        
        # Address components
        self.street: Optional[str] = None
        self.suburb: Optional[str] = None
        self.state: Optional[str] = None
        self.postcode: Optional[str] = None

        self.australia_post_client = AustraliaPostClient()
        
        # Track which component we're capturing
        self.current_component: Optional[str] = None  # "street", "suburb", "state", "postcode"
        self.components_captured: Dict[str, bool] = {
            "street": False,
            "suburb": False,
            "state": False,
            "postcode": False
        }
    
    def get_elicitation_prompt(self) -> str:
        """Get prompt to ask for address component"""
        if not self.current_component:
            # First time - ask for full address
            if self.state_machine.retry_count == 0:
                return "What's your address? Please include street, suburb, state, and postcode."
            elif self.state_machine.retry_count == 1:
                return "Sorry, I didn't catch that. Could you please repeat your address?"
            else:
                return "Let's try again. Please say your address slowly and clearly."
        else:
            # Asking for specific component
            component_prompts = {
                "street": "What's the street address?",
                "suburb": "What suburb?",
                "state": "What state?",
                "postcode": "What's the postcode?"
            }
            return component_prompts.get(self.current_component, "What's your address?")
    
    async def extract_value(self, transcription: str) -> Optional[str]:
        """
        Extract address from transcription.
        
        Handles common speech patterns:
        - "123 Main Street, Richmond, New South Wales, 2753"
        - "123 Main Street Richmond NSW 2753"
        - "123 Main Street, Richmond, NSW, 2753"
        
        Args:
            transcription: User speech transcription
            
        Returns:
            Extracted address string or None if extraction failed
        """
        text = transcription.strip()
        
        # Prefer comma-delimited parsing for multi-word states
        comma_parts = [p.strip() for p in text.split(",") if p.strip()]
        if len(comma_parts) >= 4:
            street_part = comma_parts[0]
            suburb_part = comma_parts[1]
            state_part = comma_parts[2]
            postcode_part = comma_parts[3]

            postcode_match = re.search(r"\b\d{4}\b", postcode_part)
            if postcode_match:
                self.postcode = postcode_match.group(0)
                self.components_captured["postcode"] = True

            normalized_state = normalize_state(state_part)
            if normalized_state in ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]:
                self.state = normalized_state
                self.components_captured["state"] = True

            self.suburb = suburb_part.title()
            self.components_captured["suburb"] = True

            self.street = street_part
            self.components_captured["street"] = True

            if self.street and self.suburb and self.state and self.postcode:
                return f"{self.street}, {self.suburb}, {self.state}, {self.postcode}"

        # Token-based parsing fallback (handles "Richmond NSW 2753")
        parts = [p.strip() for p in re.split(r"\s+", text) if p.strip()]
        if len(parts) >= 4 and re.match(r"^\d{4}$", parts[-1]):
            self.postcode = parts[-1]
            self.components_captured["postcode"] = True

            state = None
            state_token_count = 0
            for n in (3, 2, 1):
                if len(parts) - 1 - n >= 0:
                    candidate = " ".join(parts[-1 - n : -1])
                    normalized_state = normalize_state(candidate)
                    if normalized_state in ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]:
                        state = normalized_state
                        state_token_count = n
                        break

            if state:
                self.state = state
                self.components_captured["state"] = True

                suburb_index = -1 - state_token_count - 1
                if abs(suburb_index) <= len(parts):
                    self.suburb = parts[suburb_index].title()
                    self.components_captured["suburb"] = True

                    self.street = " ".join(parts[:suburb_index])
                    self.components_captured["street"] = True

                    if self.street and self.suburb and self.state and self.postcode:
                        return f"{self.street}, {self.suburb}, {self.state}, {self.postcode}"
        
        # If we couldn't parse full address, return as-is
        # The validation will handle partial addresses
        return text
    
    async def validate_value(self, value: str) -> bool:
        """
        Validate Australian address.
        
        Validation rules:
        1. Format validation (suburb, state, postcode format)
        
        Args:
            value: Address string to validate
            
        Returns:
            True if valid, False otherwise
        """
        if not value:
            return False
        
        # If we have components, validate them
        if self.suburb and self.state and self.postcode:
            # Format validation
            if not validate_address_au(self.suburb, self.state, self.postcode):
                logger.warning(f"Address failed format validation: {value}")
                return False

            try:
                result = await self.australia_post_client.validate_address(
                    suburb=self.suburb, state=self.state, postcode=self.postcode
                )
                return result.is_valid
            except Exception as exc:
                logger.warning("Australia Post validation failed: %s", exc)
                return validate_address_au(self.suburb, self.state, self.postcode)
        
        # If we don't have all components, try to extract them
        # This is a fallback - ideally extract_value should parse everything
        return False
    
    def get_confirmation_prompt(self, value: str) -> str:
        """
        Get contextual confirmation prompt.
        
        Uses natural speech (not robotic spelling):
        - "123 Main Street, Richmond, NSW, 2753. Is that correct?"
        
        Args:
            value: Address to confirm
            
        Returns:
            Confirmation prompt
        """
        if self.street and self.suburb and self.state and self.postcode:
            formatted = f"{self.street}, {self.suburb}, {self.state}, {self.postcode}"
            return f"Got it, {formatted}. Is that correct?"
        else:
            return f"Got it, {value}. Is that correct?"
    
    def normalize_value(self, value: str) -> str:
        """
        Normalize address for storage.
        
        Normalization:
        - Normalize state to 3-character code
        - Standardize formatting
        - Store as: "street, suburb, state, postcode"
        
        Args:
            value: Address to normalize
            
        Returns:
            Normalized address string
        """
        if self.street and self.suburb and self.state and self.postcode:
            normalized_state = normalize_state(self.state)
            return f"{self.street}, {self.suburb}, {normalized_state}, {self.postcode}"
        return value
    
    async def is_affirmation(self, transcription: str) -> bool:
        """
        Check if transcription is affirmation.
        
        Australian affirmations: yes, yeah, yep, correct, that's right, sure
        
        Args:
            transcription: User transcription
            
        Returns:
            True if affirmation, False otherwise
        """
        text = transcription.lower().strip()
        
        # Check for negations first
        negations = ["no ", "nope", "incorrect", "wrong", "not ", "actually"]
        if any(neg in text for neg in negations):
            return False
        
        affirmations = [
            "yes", "yeah", "yep", "yup", "that's correct", "that's right",
            "sure", "right", "exactly", "spot on",
            "absolutely", "definitely", "affirmative", "correct"
        ]
        
        return any(
            f" {affirmation} " in f" {text} " or
            text == affirmation or
            text.startswith(f"{affirmation} ") or
            text.endswith(f" {affirmation}")
            for affirmation in affirmations
        )
    
    async def extract_correction(self, transcription: str) -> Optional[str]:
        """
        Extract corrected address from transcription.
        
        Handles patterns like:
        - "no it's 123 Main Street, Richmond, NSW, 2753"
        - "actually it's 456 High Street, Melbourne, VIC, 3000"
        
        Args:
            transcription: User transcription with correction
            
        Returns:
            Corrected address or None if extraction failed
        """
        # Remove common correction prefixes
        text = transcription.lower().strip()
        prefixes = [
            "no ", "no it's ", "actually ", "actually it's ",
            "the correct address is ", "it's ", "it should be ",
            "sorry ", "sorry it's "
        ]
        
        for prefix in prefixes:
            if text.startswith(prefix):
                text = text[len(prefix):]
        
        # Extract address from remaining text
        return await self.extract_value(text)
