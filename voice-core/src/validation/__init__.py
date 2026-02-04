"""
Australian Validation Utilities

Provides locale-specific validation functions for Australian data formats:
- Phone numbers (04xx mobile, 02/03/07/08 landline)
- Addresses (suburb, state, postcode)
- Dates (DD/MM/YYYY format)
- States (normalization to 3-char codes)
"""

from .australian_validators import (
    validate_phone_au,
    normalize_phone_au,
    validate_address_au,
    parse_date_au,
    normalize_state,
    AmbiguousDateError,
)

__all__ = [
    "validate_phone_au",
    "normalize_phone_au",
    "validate_address_au",
    "parse_date_au",
    "normalize_state",
    "AmbiguousDateError",
]
