"""API routers for Voice Core."""

from .dashboard import router as dashboard_router
from .onboarding import router as onboarding_router
from .tenant_config import router as tenant_config_router
from .telnyx_webhook import router as telnyx_router
from .admin import (
    operations_router,
    provisioning_router,
    configure_router,
    quality_router,
    intelligence_router,
)

__all__ = [
    "dashboard_router",
    "onboarding_router",
    "tenant_config_router",
    "telnyx_router",
    "operations_router",
    "provisioning_router",
    "configure_router",
    "quality_router",
    "intelligence_router",
]
