"""Telnyx Call Control API helper for initiating outbound calls."""
from __future__ import annotations

import logging
import os
from typing import Optional, Dict, Any

import aiohttp

logger = logging.getLogger(__name__)


async def create_call(
    *,
    to_number: str,
    from_number: str,
    connection_id: str,
    webhook_url: str,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a Telnyx call via Call Control API.

    Returns the Telnyx API response JSON (includes call_control_id).
    """
    api_key = api_key or os.getenv("TELNYX_API_KEY")
    if not api_key:
        raise ValueError("TELNYX_API_KEY is not configured")

    payload = {
        "to": to_number,
        "from": from_number,
        "connection_id": connection_id,
        "webhook_url": webhook_url,
        "webhook_url_method": "POST",
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with aiohttp.ClientSession() as session:
        async with session.post("https://api.telnyx.com/v2/calls", json=payload, headers=headers) as response:
            data = await response.json()
            if response.status >= 400:
                logger.error("Telnyx create_call failed: %s", data)
                raise RuntimeError(f"Telnyx create_call failed: {data}")
            return data
