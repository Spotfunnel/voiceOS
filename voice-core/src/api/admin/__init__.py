"""Admin API routers."""

from .operations import router as operations_router
from .provisioning import router as provisioning_router
from .configure import router as configure_router
from .quality import router as quality_router
from .intelligence import router as intelligence_router

__all__ = [
    "operations_router",
    "provisioning_router",
    "configure_router",
    "quality_router",
    "intelligence_router",
]
