"""
API Clients for External Services

Provides API clients for:
- Australia Post (address validation)
"""

from .australia_post import (
    AustraliaPostClient,
    AddressValidationResult,
    SuburbLookupResult,
)

__all__ = [
    "AustraliaPostClient",
    "AddressValidationResult",
    "SuburbLookupResult",
]
