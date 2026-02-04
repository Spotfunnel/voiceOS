"""API routers for Voice Core."""

from .dashboard import router as dashboard_router
from .onboarding import router as onboarding_router
from .tenant_config import router as tenant_config_router
from .twilio_webhook import router as twilio_router

__all__ = [
    "dashboard_router",
    "onboarding_router",
    "tenant_config_router",
    "twilio_router",
]
