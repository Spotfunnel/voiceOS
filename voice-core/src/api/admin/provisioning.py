"""
Admin provisioning endpoints for operator-driven tenant setup.
"""

from typing import Any, Dict
from fastapi import APIRouter, Depends

from ...middleware.auth import require_admin

router = APIRouter(prefix="/api/admin/provisioning", tags=["admin-provisioning"])


@router.post("/validate")
async def validate_configuration(
    payload: Dict[str, Any],
    session: dict = Depends(require_admin),
) -> Dict[str, Any]:
    return {"valid": True, "errors": []}


@router.post("/test-call")
async def run_test_call(
    payload: Dict[str, Any],
    session: dict = Depends(require_admin),
) -> Dict[str, Any]:
    return {"status": "queued", "call_id": "test-call"}


@router.post("/activate")
async def activate_tenant(
    payload: Dict[str, Any],
    session: dict = Depends(require_admin),
) -> Dict[str, Any]:
    return {"status": "created", "tenant_id": "pending"}
