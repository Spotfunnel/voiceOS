"""
Primitive Registry - Routes objective_type to correct primitive implementation
"""

from typing import Dict, Type, Optional
import logging

from ..primitives.base import BaseCaptureObjective
from ..primitives.capture_address_au import CaptureAddressAU
from ..primitives.capture_datetime_au import CaptureDatetimeAU
from ..primitives.capture_email_au import CaptureEmailAU
from ..primitives.capture_name_au import CaptureNameAU
from ..primitives.capture_phone_au import CapturePhoneAU
from ..primitives.capture_service_au import CaptureServiceAU
from ..primitives.faq_handler_au import FAQHandlerAU

logger = logging.getLogger(__name__)


class PrimitiveRegistry:
    """
    Registry for mapping objective_type strings to primitive classes.
    
    This registry ensures that Orchestration can call primitives by name
    without needing to know the implementation details.
    """
    
    _primitives: Dict[str, Type[BaseCaptureObjective]] = {
        "capture_email_au": CaptureEmailAU,
        "capture_phone_au": CapturePhoneAU,
        "capture_address_au": CaptureAddressAU,
        "capture_datetime_au": CaptureDatetimeAU,
        "capture_name_au": CaptureNameAU,
        "capture_service_au": CaptureServiceAU,
        "faq_handler_au": FAQHandlerAU,
    }
    
    @classmethod
    def get_primitive(cls, objective_type: str) -> Optional[Type[BaseCaptureObjective]]:
        """
        Get primitive class for objective type.
        
        Args:
            objective_type: Objective type string (e.g., "capture_email_au")
            
        Returns:
            Primitive class or None if not found
        """
        return cls._primitives.get(objective_type)
    
    @classmethod
    def create_primitive(
        cls,
        objective_type: str,
        locale: str = "en-AU",
        max_retries: int = 3
    ) -> Optional[BaseCaptureObjective]:
        """
        Create primitive instance for objective type.
        
        Args:
            objective_type: Objective type string
            locale: Locale for validation
            max_retries: Maximum retry attempts
            
        Returns:
            Primitive instance or None if not found
        """
        primitive_class = cls.get_primitive(objective_type)
        if primitive_class is None:
            return None
        
        try:
            return primitive_class(locale=locale, max_retries=max_retries)
        except Exception as e:
            logger.error(f"Failed to create primitive {objective_type}: {e}")
            return None
    
    @classmethod
    def list_primitives(cls) -> list[str]:
        """List all registered primitive types"""
        return list(cls._primitives.keys())
    
    @classmethod
    def register(cls, objective_type: str, primitive_class: Type[BaseCaptureObjective]):
        """
        Register a new primitive type.
        
        Args:
            objective_type: Objective type string
            primitive_class: Primitive class to register
        """
        cls._primitives[objective_type] = primitive_class
        logger.info(f"Registered primitive: {objective_type} -> {primitive_class.__name__}")
