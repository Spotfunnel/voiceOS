"""
Australian Validation Utilities

Provides validation functions for Australian-specific data formats:
- Phone numbers: 04xx mobile, 02/03/07/08 landline
- Addresses: suburb, state, postcode validation
- Dates: DD/MM/YYYY format (NOT MM/DD/YYYY)
- States: normalization to 3-character codes

Critical Rules:
- Australian formats differ from US formats (100% failure rate if wrong)
- Phone: 10 digits (04xx mobile or 02/03/07/08 landline)
- Address: suburb (not city) + 4-digit postcode (not 5-digit ZIP)
- Date: DD/MM/YYYY (not MM/DD/YYYY - causes 50% error rate)
"""

import re
from typing import Optional, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


# Australian state codes mapping
STATE_CODES = {
    "new south wales": "NSW",
    "victoria": "VIC",
    "queensland": "QLD",
    "south australia": "SA",
    "western australia": "WA",
    "tasmania": "TAS",
    "northern territory": "NT",
    "australian capital territory": "ACT",
    # Also accept abbreviations
    "nsw": "NSW",
    "vic": "VIC",
    "qld": "QLD",
    "sa": "SA",
    "wa": "WA",
    "tas": "TAS",
    "nt": "NT",
    "act": "ACT",
}


class AmbiguousDateError(Exception):
    """Raised when date is ambiguous (e.g., 5/6 could be 5 June or 6 May)"""
    pass


def validate_phone_au(phone: str) -> bool:
    """
    Validate Australian phone number.
    
    Validation rules:
    - Mobile: 10 digits starting with 04 (e.g., 0412345678)
    - Landline: 10 digits with area code 02/03/07/08 (e.g., 0298765432)
    - International: +61 followed by 9 digits (without leading 0)
    
    Args:
        phone: Phone number to validate
        
    Returns:
        True if valid Australian phone number, False otherwise
        
    Examples:
        >>> validate_phone_au("0412 345 678")
        True
        >>> validate_phone_au("02 9876 5432")
        True
        >>> validate_phone_au("+61 412 345 678")
        True
        >>> validate_phone_au("1234567890")
        False
    """
    if not phone:
        return False
    
    # Remove all non-digits (except +)
    cleaned = re.sub(r'[^\d+]', '', phone)
    
    # Extract digits only for pattern matching
    digits = re.sub(r'\D', '', cleaned)
    
    # Mobile: 04xx xxx xxx (10 digits starting with 04)
    if re.match(r'^04\d{8}$', digits):
        return True
    
    # Landline: 02/03/07/08 xxxx xxxx (10 digits)
    if re.match(r'^(02|03|07|08)\d{8}$', digits):
        return True
    
    # International: +61 followed by 9 digits (without leading 0)
    if cleaned.startswith('+61') and re.match(r'^\+61[2-478]\d{8}$', cleaned):
        return True
    
    # Also accept 61 without + prefix
    if digits.startswith('61') and re.match(r'^61[2-478]\d{8}$', digits):
        return True
    
    logger.debug(f"Phone number failed validation: {phone}")
    return False


def normalize_phone_au(phone: str) -> str:
    """
    Normalize Australian phone number to +61 format for storage.
    
    Normalization:
    - Remove all non-digits
    - Convert to +61 format (remove leading 0, add +61)
    
    Examples:
        - 0412345678 → +61412345678
        - 02 9876 5432 → +61298765432
        - +61412345678 → +61412345678
        
    Args:
        phone: Phone number to normalize
        
    Returns:
        Normalized phone number in +61 format
    """
    # Remove all non-digits
    digits = re.sub(r'\D', '', phone)
    
    # If starts with 0, remove it and add +61
    if digits.startswith('0'):
        return f"+61{digits[1:]}"
    
    # If starts with 61, add + prefix
    elif digits.startswith('61'):
        return f"+{digits}"
    
    # Otherwise, assume Australian number and add +61
    else:
        return f"+61{digits}"


def normalize_state(state: str) -> str:
    """
    Normalize Australian state name to 3-character code.
    
    Handles:
    - Full names: "New South Wales" → "NSW"
    - Abbreviations: "nsw" → "NSW"
    - Already normalized: "NSW" → "NSW"
    
    Args:
        state: State name or abbreviation
        
    Returns:
        3-character state code (e.g., "NSW", "VIC", "QLD")
        
    Examples:
        >>> normalize_state("New South Wales")
        'NSW'
        >>> normalize_state("victoria")
        'VIC'
        >>> normalize_state("NSW")
        'NSW'
    """
    state_lower = state.lower().strip()
    
    # Check if already normalized (uppercase 3-char code)
    if state_lower.upper() in STATE_CODES.values():
        return state_lower.upper()
    
    # Look up in mapping
    normalized = STATE_CODES.get(state_lower)
    if normalized:
        return normalized
    
    # If not found, return uppercase (might be valid abbreviation)
    return state.upper()


def validate_address_au(
    suburb: str,
    state: str,
    postcode: str
) -> bool:
    """
    Validate Australian address components.
    
    Basic validation (format only):
    - Suburb: non-empty string
    - State: valid 3-character code
    - Postcode: 4 digits
    
    Note: Full validation requires Australia Post API (see australia_post.py)
    to handle suburb conflicts (e.g., Richmond exists in 4 states).
    
    Args:
        suburb: Suburb name
        state: State name or code
        postcode: Postcode (4 digits)
        
    Returns:
        True if format is valid, False otherwise
        
    Examples:
        >>> validate_address_au("Richmond", "NSW", "2753")
        True
        >>> validate_address_au("Richmond", "VIC", "3121")
        True
        >>> validate_address_au("Richmond", "NSW", "12345")
        False  # Invalid postcode format
    """
    if not suburb or not suburb.strip():
        return False
    
    # Normalize state
    state_code = normalize_state(state)
    if state_code not in STATE_CODES.values():
        return False
    
    # Postcode must be 4 digits
    postcode_digits = re.sub(r'\D', '', postcode)
    if not re.match(r'^\d{4}$', postcode_digits):
        return False
    
    return True


def parse_date_au(date_str: str) -> datetime:
    """
    Parse Australian date string (DD/MM/YYYY format).
    
    Critical: Assumes DD/MM/YYYY (NOT MM/DD/YYYY).
    Raises AmbiguousDateError if date is ambiguous (e.g., 5/6/2026).
    
    Args:
        date_str: Date string in DD/MM/YYYY format
        
    Returns:
        Parsed datetime object
        
    Raises:
        AmbiguousDateError: If date is ambiguous (both day and month <= 12)
        ValueError: If date format is invalid
        
    Examples:
        >>> parse_date_au("15/10/2026")
        datetime.datetime(2026, 10, 15, 0, 0)
        >>> parse_date_au("5/6/2026")
        AmbiguousDateError  # Could be 5 June or 6 May
    """
    # Try DD/MM/YYYY format
    if '/' in date_str:
        parts = date_str.split('/')
        
        if len(parts) != 3:
            raise ValueError(f"Invalid date format: {date_str}. Expected DD/MM/YYYY")
        
        try:
            day = int(parts[0])
            month = int(parts[1])
            year = int(parts[2])
        except ValueError:
            raise ValueError(f"Invalid date format: {date_str}. Expected DD/MM/YYYY")
        
        # Detect ambiguity (both day and month <= 12)
        if day <= 12 and month <= 12 and day != month:
            raise AmbiguousDateError(
                f"Ambiguous date: {date_str}. "
                f"Is this {day} {_month_name(day)} or {month} {_month_name(month)}?"
            )
        
        # Assume DD/MM/YYYY (Australian format)
        # If month > 12, must be DD/MM/YYYY
        if month > 12:
            # Invalid month - swap day and month
            day, month = month, day
        
        return datetime(year, month, day)
    
    # Try other formats (ISO, natural language handled separately)
    raise ValueError(f"Unsupported date format: {date_str}. Expected DD/MM/YYYY")


def _month_name(month_num: int) -> str:
    """Get month name from number (1-12)"""
    months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
    if 1 <= month_num <= 12:
        return months[month_num - 1]
    return ""


def get_timezone_for_state(state: str) -> str:
    """
    Get Australian timezone for state.
    
    Timezone mapping:
    - NSW, VIC, QLD, TAS, ACT: Australia/Sydney (AEST/AEDT)
    - SA, NT: Australia/Adelaide (ACST/ACDT)
    - WA: Australia/Perth (AWST)
    
    Args:
        state: State code (e.g., "NSW", "VIC")
        
    Returns:
        Timezone name (e.g., "Australia/Sydney")
        
    Examples:
        >>> get_timezone_for_state("NSW")
        'Australia/Sydney'
        >>> get_timezone_for_state("WA")
        'Australia/Perth'
    """
    state_code = normalize_state(state)
    
    timezone_map = {
        "NSW": "Australia/Sydney",  # AEST/AEDT
        "VIC": "Australia/Melbourne",  # AEST/AEDT
        "QLD": "Australia/Brisbane",  # AEST (no DST)
        "SA": "Australia/Adelaide",  # ACST/ACDT
        "WA": "Australia/Perth",  # AWST (no DST)
        "TAS": "Australia/Hobart",  # AEST/AEDT
        "NT": "Australia/Darwin",  # ACST (no DST)
        "ACT": "Australia/Sydney",  # AEST/AEDT
    }
    
    return timezone_map.get(state_code, "Australia/Sydney")  # Default to Sydney
