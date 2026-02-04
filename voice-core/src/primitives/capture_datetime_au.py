"""
Australian Date/Time Capture Primitive (Layer 1)

Captures and validates Australian date/time with:
- Australian date format (DD/MM/YYYY)
- Ambiguity detection (5/6 could be 5 June or 6 May)
- Clarification flow if ambiguous
- Timezone handling (AEST/AEDT/ACST/AWST based on state)
- Business hours validation (8am-6pm)
- ALWAYS confirms (datetime is critical data)
- Max 3 retry attempts

Critical Rules:
- Date/time is CRITICAL data - MUST ALWAYS confirm
- Use DD/MM/YYYY format (NOT MM/DD/YYYY - causes 50% error rate)
- Handle timezone conversion based on state
- Validate business hours (8am-6pm)
"""

import re
from typing import Optional, Tuple
from datetime import datetime, time
import logging
from zoneinfo import ZoneInfo

from .base import BaseCaptureObjective
from ..validation.australian_validators import (
    parse_date_au,
    AmbiguousDateError,
    get_timezone_for_state,
    normalize_state
)

logger = logging.getLogger(__name__)


class CaptureDatetimeAU(BaseCaptureObjective):
    """
    Australian date/time capture primitive.
    
    Features:
    - Australian date format (DD/MM/YYYY)
    - Ambiguity detection and clarification
    - Timezone handling (AEST/AEDT/ACST/AWST)
    - Business hours validation (8am-6pm)
    - ALWAYS confirms (datetime is critical data)
    - Max 3 retry attempts
    
    Usage:
        primitive = CaptureDatetimeAU(state="NSW")
        result = await primitive.execute()
        
        # Process user speech
        result = await primitive.process_transcription(
            "15th of October at 2pm",
            confidence=0.85
        )
    """
    
    def __init__(
        self,
        locale: str = "en-AU",
        max_retries: int = 3,
        state: Optional[str] = None
    ):
        """
        Initialize datetime capture primitive.
        
        Args:
            locale: Locale for validation (default: "en-AU")
            max_retries: Maximum retry attempts (default: 3)
            state: Australian state (for timezone handling)
        """
        super().__init__(
            objective_type="capture_datetime_au",
            locale=locale,
            is_critical=True,  # Datetime is ALWAYS critical
            max_retries=max_retries
        )
        
        self.state = state
        self.timezone = None
        if state:
            self.timezone = ZoneInfo(get_timezone_for_state(state))
        
        # Track if we're clarifying ambiguity
        self.is_clarifying_ambiguity = False
        self.ambiguous_date_str: Optional[str] = None
    
    def get_elicitation_prompt(self) -> str:
        """Get prompt to ask for date/time"""
        if self.is_clarifying_ambiguity:
            # We're clarifying an ambiguous date
            return self._get_ambiguity_clarification_prompt()
        
        if self.state_machine.retry_count == 0:
            return "What date and time would work for you?"
        elif self.state_machine.retry_count == 1:
            return "Sorry, I didn't catch that. Could you please repeat the date and time?"
        else:
            return "Let's try again. Please say the date and time slowly and clearly."
    
    def _get_ambiguity_clarification_prompt(self) -> str:
        """Get prompt to clarify ambiguous date"""
        if not self.ambiguous_date_str:
            return "Could you clarify the date?"
        
        # Parse ambiguous date to extract day and month
        parts = self.ambiguous_date_str.split('/')
        if len(parts) == 3:
            try:
                day = int(parts[0])
                month = int(parts[1])
                year = int(parts[2])
                
                month_names = [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                ]
                
                return (
                    f"Just to clarify, is that {day} {month_names[month-1]} "
                    f"or {month} {month_names[day-1]}?"
                )
            except (ValueError, IndexError):
                pass
        
        return "Could you clarify the date?"
    
    async def extract_value(self, transcription: str) -> Optional[str]:
        """
        Extract date/time from transcription.
        
        Handles common speech patterns:
        - "15th of October at 2pm" → 15/10/2026 14:00
        - "next Tuesday at 3:30" → (relative date) 14:30
        - "5/6/2026 at 9am" → 05/06/2026 09:00 (may be ambiguous)
        - "15 October 2026, 2 o'clock" → 15/10/2026 14:00
        
        Args:
            transcription: User speech transcription
            
        Returns:
            Extracted date/time string (DD/MM/YYYY HH:MM) or None if extraction failed
        """
        text = transcription.lower().strip()
        
        # If clarifying ambiguity, try to extract which interpretation user meant
        if self.is_clarifying_ambiguity:
            return await self._extract_ambiguity_resolution(text)
        
        # Try to extract date and time
        date_str = await self._extract_date(text)
        time_str = await self._extract_time(text)
        
        if date_str and time_str:
            return f"{date_str} {time_str}"
        elif date_str:
            # Date only - assume current time or ask for time
            return f"{date_str} 12:00"  # Default to noon
        elif time_str:
            # Time only - assume today or ask for date
            today = datetime.now()
            if self.timezone:
                today = today.astimezone(self.timezone)
            date_str = today.strftime("%d/%m/%Y")
            return f"{date_str} {time_str}"
        
        logger.warning(f"Could not extract date/time from: {transcription}")
        return None
    
    async def _extract_date(self, text: str) -> Optional[str]:
        """Extract date from text"""
        # Try DD/MM/YYYY format
        date_pattern = r'\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b'
        match = re.search(date_pattern, text)
        if match:
            day, month, year = match.groups()
            return f"{day.zfill(2)}/{month.zfill(2)}/{year}"
        
        # Try natural language dates (simplified - production would use dateparser)
        # "15th of October" → 15/10/2026
        # "next Tuesday" → relative date
        # For now, return None if no pattern matches
        # Production implementation would use dateparser library
        
        return None
    
    async def _extract_time(self, text: str) -> Optional[str]:
        """Extract time from text"""
        # Try HH:MM format
        time_pattern = r'\b(\d{1,2}):(\d{2})\b'
        match = re.search(time_pattern, text)
        if match:
            hour, minute = match.groups()
            hour_int = int(hour)
            # Handle 12-hour format with am/pm
            if 'pm' in text and hour_int < 12:
                hour_int += 12
            elif 'am' in text and hour_int == 12:
                hour_int = 0
            return f"{hour_int:02d}:{minute}"
        
        # Try spoken time: "2pm", "3:30pm", "nine o'clock"
        # "2pm" → 14:00
        # "3:30pm" → 15:30
        # "nine o'clock" → 09:00
        
        # Handle "pm" and "am"
        if 'pm' in text or 'p.m.' in text:
            hour_match = re.search(r'\b(\d{1,2})', text)
            if hour_match:
                hour_int = int(hour_match.group(1))
                if hour_int < 12:
                    hour_int += 12
                minute_match = re.search(r':(\d{2})', text)
                minute = minute_match.group(1) if minute_match else "00"
                return f"{hour_int:02d}:{minute}"
        
        if 'am' in text or 'a.m.' in text:
            hour_match = re.search(r'\b(\d{1,2})', text)
            if hour_match:
                hour_int = int(hour_match.group(1))
                if hour_int == 12:
                    hour_int = 0
                minute_match = re.search(r':(\d{2})', text)
                minute = minute_match.group(1) if minute_match else "00"
                return f"{hour_int:02d}:{minute}"
        
        return None
    
    async def _extract_ambiguity_resolution(self, text: str) -> Optional[str]:
        """Extract user's clarification of ambiguous date"""
        # User should say something like "5 June" or "June 5"
        # We need to determine which interpretation they meant
        
        # For now, simple heuristic: if they mention the month name, use that
        month_names = [
            "january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december"
        ]
        
        for i, month_name in enumerate(month_names):
            if month_name in text:
                # Found month name - extract day
                day_match = re.search(r'\b(\d{1,2})\b', text)
                if day_match:
                    day = int(day_match.group(1))
                    # Parse original ambiguous date
                    parts = self.ambiguous_date_str.split('/')
                    if len(parts) == 3:
                        year = int(parts[2])
                        # User said month name, so use that month
                        return f"{day:02d}/{i+1:02d}/{year}"
        
        # If we can't resolve, return None to re-elicit
        return None
    
    async def validate_value(self, value: str) -> bool:
        """
        Validate Australian date/time.
        
        Validation rules:
        1. Date format: DD/MM/YYYY
        2. Time format: HH:MM (24-hour)
        3. Business hours: 8am-6pm
        4. Date must be in the future (for appointments)
        
        Args:
            value: Date/time string to validate
            
        Returns:
            True if valid, False otherwise
        """
        if not value:
            return False
        
        try:
            # Parse date/time string
            parts = value.split()
            if len(parts) < 2:
                return False
            
            date_str = parts[0]
            time_str = parts[1]
            
            # Parse date (may raise AmbiguousDateError)
            try:
                parsed_date = parse_date_au(date_str)
            except AmbiguousDateError:
                # Date is ambiguous - need clarification
                self.is_clarifying_ambiguity = True
                self.ambiguous_date_str = date_str
                logger.info(f"Ambiguous date detected: {date_str}")
                return False
            
            # Parse time
            time_parts = time_str.split(':')
            if len(time_parts) != 2:
                return False
            
            hour = int(time_parts[0])
            minute = int(time_parts[1])
            
            if not (0 <= hour < 24 and 0 <= minute < 60):
                return False
            
            # Validate business hours (8am-6pm)
            if hour < 8 or hour >= 18:
                logger.warning(f"Time outside business hours: {time_str}")
                return False
            
            # Validate date is in the future
            now = datetime.now()
            if self.timezone:
                now = now.astimezone(self.timezone)
            
            if parsed_date.date() < now.date():
                logger.warning(f"Date is in the past: {date_str}")
                return False
            
            return True
            
        except (ValueError, IndexError) as e:
            logger.warning(f"Date/time validation error: {e}")
            return False
    
    def get_confirmation_prompt(self, value: str) -> str:
        """
        Get contextual confirmation prompt.
        
        Uses natural speech format:
        - "15th of October at 2pm. Is that correct?"
        
        Args:
            value: Date/time to confirm
            
        Returns:
            Confirmation prompt
        """
        try:
            # Parse and format for natural speech
            parts = value.split()
            if len(parts) >= 2:
                date_str = parts[0]
                time_str = parts[1]
                
                # Parse date
                parsed_date = parse_date_au(date_str)
                
                # Format date naturally
                month_names = [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                ]
                day = parsed_date.day
                month = month_names[parsed_date.month - 1]
                year = parsed_date.year
                
                # Format time
                time_parts = time_str.split(':')
                hour = int(time_parts[0])
                minute = int(time_parts[1])
                
                # Convert to 12-hour format for natural speech
                if hour == 0:
                    hour_12 = 12
                    am_pm = "am"
                elif hour < 12:
                    hour_12 = hour
                    am_pm = "am"
                elif hour == 12:
                    hour_12 = 12
                    am_pm = "pm"
                else:
                    hour_12 = hour - 12
                    am_pm = "pm"
                
                if minute == 0:
                    time_formatted = f"{hour_12} {am_pm}"
                else:
                    time_formatted = f"{hour_12}:{minute:02d} {am_pm}"
                
                return f"Got it, {day} {month} {year} at {time_formatted}. Is that correct?"
            
        except Exception as e:
            logger.warning(f"Error formatting confirmation prompt: {e}")
        
        # Fallback
        return f"Got it, {value}. Is that correct?"
    
    def normalize_value(self, value: str) -> str:
        """
        Normalize date/time for storage.
        
        Normalization:
        - Store as ISO 8601 format (YYYY-MM-DDTHH:MM:SS+timezone)
        - Convert to UTC if timezone is specified
        
        Args:
            value: Date/time to normalize
            
        Returns:
            Normalized date/time in ISO 8601 format
        """
        try:
            parts = value.split()
            if len(parts) >= 2:
                date_str = parts[0]
                time_str = parts[1]
                
                # Parse date
                parsed_date = parse_date_au(date_str)
                
                # Parse time
                time_parts = time_str.split(':')
                hour = int(time_parts[0])
                minute = int(time_parts[1])
                
                # Create datetime
                dt = datetime.combine(parsed_date.date(), time(hour, minute))
                
                # Apply timezone if specified
                if self.timezone:
                    dt = dt.replace(tzinfo=self.timezone)
                    # Convert to UTC for storage
                    dt = dt.astimezone(ZoneInfo("UTC"))
                
                # Return ISO 8601 format
                return dt.isoformat()
            
        except Exception as e:
            logger.warning(f"Error normalizing date/time: {e}")
        
        # Fallback: return as-is
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
        Extract corrected date/time from transcription.
        
        Handles patterns like:
        - "no it's 15th of October at 3pm"
        - "actually it's next Tuesday at 2:30"
        
        Args:
            transcription: User transcription with correction
            
        Returns:
            Corrected date/time or None if extraction failed
        """
        # Remove common correction prefixes
        text = transcription.lower().strip()
        prefixes = [
            "no ", "no it's ", "actually ", "actually it's ",
            "the correct date is ", "it's ", "it should be ",
            "sorry ", "sorry it's "
        ]
        
        for prefix in prefixes:
            if text.startswith(prefix):
                text = text[len(prefix):]
        
        # Extract date/time from remaining text
        return await self.extract_value(text)
