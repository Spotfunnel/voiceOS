"""
Capture primitives (Layer 1)

These primitives are immutable across customers.
Customer-specific logic belongs in Layer 2 (orchestration).
"""

from .base import BaseCaptureObjective, CaptureResult
from .capture_email_au import CaptureEmailAU
from .capture_phone_au import CapturePhoneAU
from .capture_address_au import CaptureAddressAU
from .capture_datetime_au import CaptureDatetimeAU
from .email_capture_processor import EmailCaptureProcessor

__all__ = [
    "BaseCaptureObjective",
    "CaptureResult",
    "CaptureEmailAU",
    "CapturePhoneAU",
    "CaptureAddressAU",
    "CaptureDatetimeAU",
    "EmailCaptureProcessor",
]
