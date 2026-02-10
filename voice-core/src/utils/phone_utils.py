"""
Phone number utilities (lightweight, no database dependencies).
"""

import re


def normalize_phone_number(phone: str) -> str:
    """
    Normalize phone number to E.164 format for matching.
    """
    digits = re.sub(r"[^\d+]", "", phone)
    if not digits:
        return phone

    if not digits.startswith("+"):
        if digits.startswith("61"):
            digits = f"+{digits}"
        elif digits.startswith("0"):
            digits = f"+61{digits[1:]}"
        else:
            digits = f"+{digits}"

    return digits
