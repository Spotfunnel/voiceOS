"""
n8n workflow integration helpers.

Includes HTTP client for triggering n8n webhooks, workflow registry, and helper to fire all tenant workflows.
"""

from __future__ import annotations

import asyncio
import os
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Any, Optional, List

import httpx

logger = logging.getLogger(__name__)


@dataclass
class N8nWorkflowTrigger:
    webhook_url: str
    tenant_id: str
    workflow_name: str
    auth_token: Optional[str] = None
    timeout_seconds: int = 30


class N8nClient:
    """
    Client for triggering n8n workflows.
    """

    def __init__(self, default_timeout: int = 30, max_retries: int = 3):
        self.default_timeout = default_timeout
        self.max_retries = max_retries
        self.client = httpx.AsyncClient(timeout=default_timeout)

    async def trigger_workflow(
        self, trigger: N8nWorkflowTrigger, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        payload = {
            "tenant_id": trigger.tenant_id,
            "workflow_name": trigger.workflow_name,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "data": data,
            "source": "voice_core",
        }

        headers = {"Content-Type": "application/json"}
        if trigger.auth_token:
            headers["Authorization"] = f"Bearer {trigger.auth_token}"

        attempt = 0
        last_error: Optional[Exception] = None

        while attempt < self.max_retries:
            try:
                logger.info(
                    "Triggering n8n workflow: %s (attempt %d/%d)",
                    trigger.workflow_name,
                    attempt + 1,
                    self.max_retries,
                )
                response = await self.client.post(
                    trigger.webhook_url,
                    json=payload,
                    headers=headers,
                    timeout=trigger.timeout_seconds or self.default_timeout,
                )
                response.raise_for_status()
                logger.info(
                    "n8n workflow %s triggered (status=%d)",
                    trigger.workflow_name,
                    response.status_code,
                )
                return response.json() if response.text else {"status": "success"}
            except httpx.HTTPError as exc:
                last_error = exc
                attempt += 1
                logger.warning(
                    "n8n workflow failed (%s) attempt %d/%d: %s",
                    trigger.workflow_name,
                    attempt,
                    self.max_retries,
                    exc,
                )
                if attempt < self.max_retries:
                    await asyncio.sleep(2 ** attempt)

        logger.error(
            "n8n workflow %s failed after %d attempts",
            trigger.workflow_name,
            self.max_retries,
        )
        raise last_error or RuntimeError("n8n workflow failed")

    async def close(self):
        await self.client.aclose()


class N8nWorkflowRegistry:
    def __init__(self):
        self.workflows: Dict[str, List[N8nWorkflowTrigger]] = {}

    def register_workflow(
        self,
        tenant_id: str,
        workflow_name: str,
        webhook_url: str,
        auth_token: Optional[str] = None,
        timeout_seconds: int = 30,
    ):
        trigger = N8nWorkflowTrigger(
            tenant_id=tenant_id,
            workflow_name=workflow_name,
            webhook_url=webhook_url,
            auth_token=auth_token,
            timeout_seconds=timeout_seconds,
        )
        self.workflows.setdefault(tenant_id, []).append(trigger)
        logger.info("Registered n8n workflow %s for tenant %s", workflow_name, tenant_id)

    def get_workflows(self, tenant_id: str) -> List[N8nWorkflowTrigger]:
        return self.workflows.get(tenant_id, [])

    def load_from_config(self, config: Dict[str, Any]):
        tenant_id = config.get("tenant_id")
        if not tenant_id:
            return

        for workflow in config.get("n8n_workflows", []):
            self.register_workflow(
                tenant_id=tenant_id,
                workflow_name=workflow["name"],
                webhook_url=workflow["webhook_url"],
                auth_token=workflow.get("auth_token"),
                timeout_seconds=workflow.get("timeout_seconds", 30),
            )


workflow_registry = N8nWorkflowRegistry()


async def trigger_workflows_for_tenant(
    tenant_id: str, captured_data: Dict[str, Any]
) -> List[Dict[str, Any]]:
    workflows = workflow_registry.get_workflows(tenant_id)
    if not workflows:
        logger.info("No n8n workflows for tenant %s", tenant_id)
        return []

    client = N8nClient()
    responses = []
    try:
        for workflow in workflows:
            try:
                response = await client.trigger_workflow(workflow, captured_data)
                responses.append(
                    {"workflow": workflow.workflow_name, "status": "success", "response": response}
                )
            except Exception as exc:
                logger.error("n8n workflow %s failed: %s", workflow.workflow_name, exc)
                responses.append(
                    {"workflow": workflow.workflow_name, "status": "error", "error": str(exc)}
                )
    finally:
        await client.close()

    return responses
