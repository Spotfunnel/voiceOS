"\"\"\""
"Call initiator service for triggering the bot runner start_call endpoint."
"\"\"\""

import logging
import os
from typing import Any, Dict

import httpx

logger = logging.getLogger(__name__)

BOT_RUNNER_URL = os.getenv("BOT_RUNNER_URL", "http://localhost:8000").rstrip("/")
DEFAULT_SYSTEM_PROMPT = os.getenv(
    "DEFAULT_SYSTEM_PROMPT",
    "You are a helpful AI assistant for SpotFunnel."
)


async def start_bot_call(
    call_sid: str,
    tenant_id: str,
    caller_phone: str,
    config: Dict[str, Any],
    system_prompt: str = DEFAULT_SYSTEM_PROMPT,
) -> bool:
    """
    Call the bot runner /start_call endpoint to begin a Twilio session.
    """
    if not BOT_RUNNER_URL:
        logger.error("BOT_RUNNER_URL is not configured")
        return False

    request_payload = {
        "call_id": call_sid,
        "transport": "twilio",
        "transport_type": "twilio",
        "call_sid": call_sid,
        "tenant_id": tenant_id,
        "caller_phone": caller_phone,
        "system_prompt": system_prompt,
        "config": config,
    }

    endpoint = f"{BOT_RUNNER_URL}/start_call"

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
            response = await client.post(endpoint, json=request_payload)
            if response.status_code == 200:
                logger.info("Triggered start_call for CallSid=%s", call_sid)
                return True

            logger.error(
                "start_call failed for CallSid=%s status=%s body=%s",
                call_sid,
                response.status_code,
                response.text,
            )
            return False

    except Exception as exc:
        logger.exception("Error calling start_call: %s", exc)
        return False
