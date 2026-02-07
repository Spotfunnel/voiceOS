"""
Admin configure endpoints for versioned configuration.
"""

from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, Depends

from ...middleware.auth import require_admin

router = APIRouter(prefix="/api/admin/configure", tags=["admin-configure"])


@router.get("/config/{section}")
async def get_config_section(section: str, session: dict = Depends(require_admin)) -> Dict[str, Any]:
    return {
        "version": "v1.0.0",
        "content": {},
        "last_modified": None,
        "modified_by": None,
    }


@router.put("/config/{section}")
async def update_config_section(
    section: str,
    data: Dict[str, Any],
    session: dict = Depends(require_admin),
) -> Dict[str, Any]:
    if "content" not in data:
        raise HTTPException(status_code=400, detail="content required")
    return {
        "version": "v1.0.1",
        "diff": "",
        "audit_id": "pending",
    }


@router.get("/config/{section}/versions")
async def get_config_versions(
    section: str,
    limit: int = 20,
    session: dict = Depends(require_admin),
) -> List[Dict[str, Any]]:
    return []


@router.post("/config/{section}/rollback")
async def rollback_config(
    section: str,
    version: str,
    session: dict = Depends(require_admin),
) -> Dict[str, Any]:
    return {"rolled_back_to": version}


@router.get("/audit-log")
async def get_audit_log(limit: int = 50, session: dict = Depends(require_admin)) -> List[Dict[str, Any]]:
    return []
