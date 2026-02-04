"""
Australian Phone Capture Primitive (Layer 1)

Captures and validates Australian phone numbers with:
- Australian phone format validation (04xx mobile, 02/03/07/08 landline)
- Multi-ASR voting for Australian accent
- ALWAYS confirms (regardless of confidence) per R-ARCH-006
- Normalize to +61 format for storage
- Max 3 retry attempts

Phone Format Rules:
- Mobile: 10 digits starting with 04 (e.g., 0412 345 678)
- Landline: 10 digits with area code 02/03/07/08 (e.g., 02 9876 5432)
- International: +61 (remove leading 0)

Critical Rules:
- Phone is CRITICAL data - MUST ALWAYS confirm
- Use multi-ASR voting for Australian accent
- Contextual confirmation (not digit-by-digit)
"""

import re
from typing import Optional
import logging

from .base import BaseCaptureObjective
from ..validation.australian_validators import validate_phone_au, normalize_phone_au

logger = logging.getLogger(__name__)


class CapturePhoneAU(BaseCaptureObjective):
    """
    Australian phone number capture primitive.
    
    Features:
    - Australian phone format validation
    - Multi-ASR voting for Australian accent
    - ALWAYS confirms (phone is critical data)
    - Normalize to +61 format for storage
    - Max 3 retry attempts
    
    Supported formats:
    - Mobile: 0412 345 678, 04 1234 5678, 0412345678
    - Landline: 02 9876 5432, (02) 9876 5432, 0298765432
    - International: +61 412 345 678, +61412345678
    
    Usage:
        primitive = CapturePhoneAU()
        result = await primitive.execute()
        
        # Process user speech
        result = await primitive.process_transcription(
            "zero four one two three four five six seven eight",
            confidence=0.85
        )
    """
    
    def __init__(self, locale: str = "en-AU", max_retries: int = 3):
        """
        Initialize phone capture primitive.
        
        Args:
            locale: Locale for validation (default: "en-AU")
            max_retries: Maximum retry attempts (default: 3)
        """
        super().__init__(
            objective_type="capture_phone_au",
            locale=locale,
            is_critical=True,  # Phone is ALWAYS critical
            max_retries=max_retries
        )
    
    def get_elicitation_prompt(self) -> str:
        """Get prompt to ask for phone number"""
        if self.state_machine.retry_count == 0:
            return "What's your phone number?"
        elif self.state_machine.retry_count == 1:
            return "Sorry, I didn't catch that. Could you please repeat your phone number?"
        else:
            return "Let's try again. Please say your phone number slowly and clearly."
    
    async def extract_value(self, transcription: str) -> Optional[str]:
        """
        Extract phone number from transcription.
        
        Handles common speech patterns:
        - "zero four one two three four five six seven eight" → 0412345678
        - "oh four one two, three four five, six seven eight" → 0412345678
        - "zero four one two three four five six seven eight" → 0412345678
        - "plus six one four one two three four five six seven eight" → +61412345678
        
        Args:
            transcription: User speech transcription
            
        Returns:
            Extracted phone number (digits only) or None if extraction failed
        """
        # Normalize transcription
        text = transcription.lower().strip()
        
        # Replace spoken numbers with digits (use word boundaries to avoid partial matches)
        # Map spoken words to digits
        spoken_numbers = {
            "zero": "0", "oh": "0", "o": "0",  # "o" can be spoken as "oh"
            "one": "1", "two": "2", "three": "3",
            "four": "4", "five": "5", "six": "6", "seven": "7",
            "eight": "8", "nine": "9", "plus": "+"
        }
        
        # Replace spoken numbers (handle word boundaries)
        # Split by word boundaries and replace
        words = re.split(r'[\s,]+', text)
        replaced_words = []
        
        for word in words:
            # Remove punctuation
            word_clean = re.sub(r'[^\w]', '', word)
            if word_clean in spoken_numbers:
                replaced_words.append(spoken_numbers[word_clean])
            else:
                # Try to find partial matches (e.g., "zero" in "zero-four")
                for spoken, digit in spoken_numbers.items():
                    if spoken in word_clean:
                        word_clean = word_clean.replace(spoken, digit)
                replaced_words.append(word_clean)
        
        # Join and extract digits
        text = " ".join(replaced_words)
        
        # Remove spaces, dashes, parentheses, and other non-digit characters (except +)
        digits = re.sub(r'[^\d+]', '', text)
        
        # Check if we have a valid-looking phone number
        # Australian numbers are 10 digits (or 9 digits with +61 prefix)
        if len(digits) >= 9:  # Allow 9 digits (without leading 0) or 10 digits
            return digits
        
        logger.warning(f"Could not extract phone number from: {transcription}")
        return None
    
    async def validate_value(self, value: str) -> bool:
        """
        Validate Australian phone number.
        
        Uses validation utilities from australian_validators.
        
        Args:
            value: Phone number to validate
            
        Returns:
            True if valid Australian phone, False otherwise
        """
        return validate_phone_au(value)
    
    def get_confirmation_prompt(self, value: str) -> str:
        """
        Get contextual confirmation prompt.
        
        Uses natural grouping (not digit-by-digit):
        - Mobile: "0412 345 678"
        - Landline: "02 9876 5432"
        
        Args:
            value: Phone number to confirm
            
        Returns:
            Confirmation prompt
        """
        # Format phone number for natural speech
        digits = re.sub(r'\D', '', value)
        
        # Mobile format: 04xx xxx xxx
        if digits.startswith('04') and len(digits) == 10:
            formatted = f"{digits[0:4]} {digits[4:7]} {digits[7:10]}"
            return f"Got it, {formatted}. Is that right?"
        
        # Landline format: 0x xxxx xxxx
        elif digits[0] == '0' and len(digits) == 10:
            formatted = f"{digits[0:2]} {digits[2:6]} {digits[6:10]}"
            return f"Got it, {formatted}. Is that right?"
        
        # International format: +61 xxx xxx xxx
        elif value.startswith('+61'):
            formatted = f"+61 {digits[2:5]} {digits[5:8]} {digits[8:11]}"
            return f"Got it, {formatted}. Is that right?"
        
        # Fallback: just confirm as-is
        return f"Got it, {value}. Is that right?"
    
    def normalize_value(self, value: str) -> str:
        """
        Normalize phone number to +61 format for storage.
        
        Normalization:
        - Remove all non-digits
        - Convert to +61 format (remove leading 0, add +61)
        
        Examples:
        - 0412345678 → +61412345678
        - 02 9876 5432 → +61298765432
        - +61412345678 → +61412345678
        
        Args:
            value: Phone number to normalize
            
        Returns:
            Normalized phone number in +61 format
        """
        # Remove all non-digits
        digits = re.sub(r'\D', '', value)
        
        # If starts with 0, remove it and add +61
        if digits.startswith('0'):
            return f"+61{digits[1:]}"
        
        # If starts with 61, add + prefix
        elif digits.startswith('61'):
            return f"+{digits}"
        
        # Otherwise, assume Australian number and add +61
        else:
            return f"+61{digits}"
    
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
        
        # Check for negations first - these take precedence
        negations = ["no ", "nope", "incorrect", "wrong", "not ", "actually"]
        if any(neg in text for neg in negations):
            return False
        
        affirmations = [
            "yes", "yeah", "yep", "yup", "that's correct", "that's right",
            "sure", "right", "exactly", "spot on",
            "absolutely", "definitely", "affirmative", "correct"
        ]
        
        # Check for exact matches or word boundaries to avoid false positives
        return any(
            f" {affirmation} " in f" {text} " or 
            text == affirmation or
            text.startswith(f"{affirmation} ") or
            text.endswith(f" {affirmation}")
            for affirmation in affirmations
        )
    
    async def extract_correction(self, transcription: str) -> Optional[str]:
        """
        Extract corrected phone number from transcription.
        
        Handles patterns like:
        - "no it's zero four one two three four five six seven eight"
        - "actually it's oh four one two, three four five, six seven eight"
        
        Args:
            transcription: User transcription with correction
            
        Returns:
            Corrected phone number or None if extraction failed
        """
        # Remove common correction prefixes
        text = transcription.lower().strip()
        prefixes = [
            "no ", "no it's ", "actually ", "actually it's ",
            "the correct number is ", "it's ", "it should be ",
            "sorry ", "sorry it's "
        ]
        
        for prefix in prefixes:
            if text.startswith(prefix):
                text = text[len(prefix):]
        
        # Extract phone number from remaining text
        return await self.extract_value(text)
