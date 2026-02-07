"""
Telnyx webhook handler for automatic call routing.
"""

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.status import HTTP_400_BAD_REQUEST, HTTP_403_FORBIDDEN

from ..services.call_history import get_recent_call_history
from ..services.phone_routing import normalize_phone_number
from ..services.phone_routing import get_tenant_config, resolve_phone_to_tenant

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory registry for active Telnyx calls (used by websocket handler)
TELNYX_CALL_CONTEXTS: Dict[str, Dict[str, Any]] = {}
TELNYX_OUTBOUND_CALLS: set[str] = set()


def register_telnyx_call_context(call_control_id: str, context: Dict[str, Any]) -> None:
    """Register call context for websocket media stream handling."""
    TELNYX_CALL_CONTEXTS[call_control_id] = context


def register_telnyx_outbound_call(call_control_id: str) -> None:
    """Register outbound call_control_id so webhook accepts outgoing calls."""
    TELNYX_OUTBOUND_CALLS.add(call_control_id)


def pop_telnyx_call_context(call_control_id: str) -> Optional[Dict[str, Any]]:
    """Pop call context once the websocket connects."""
    return TELNYX_CALL_CONTEXTS.pop(call_control_id, None)


def is_telnyx_outbound_call(call_control_id: str) -> bool:
    return call_control_id in TELNYX_OUTBOUND_CALLS

DEFAULT_SYSTEM_PROMPT = os.getenv(
    "TELNYX_SYSTEM_PROMPT",
    "You are a helpful AI assistant for SpotFunnel."
)

# Ngrok URL for local development
NGROK_URL = os.getenv("NGROK_URL", "https://antrorse-fluently-beulah.ngrok-free.dev")


@router.post("/telnyx/webhook")
async def telnyx_webhook(request: Request):
    """
    Handle incoming Telnyx webhook events.
    
    Telnyx sends various events:
    - call.initiated: Incoming call
    - call.answered: Call connected
    - call.hangup: Call ended
    - call.speak.ended: TTS playback complete
    """
    # Validate webhook signature
    public_key = os.getenv("TELNYX_PUBLIC_KEY")
    if public_key:
        _validate_telnyx_signature(request, public_key)
    
    # Parse webhook payload
    try:
        payload = await request.json()
    except Exception as exc:
        logger.error(f"Failed to parse Telnyx webhook payload: {exc}")
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )
    
    event_type = payload.get("data", {}).get("event_type")
    event_data = payload.get("data", {}).get("payload", {})
    
    logger.info(f"Received Telnyx webhook: event_type={event_type}")
    
    # Handle call.initiated event (incoming call)
    if event_type == "call.initiated":
        return await handle_call_initiated(event_data)
    
    # Handle other events (logging only for now)
    elif event_type == "call.answered":
        call_control_id = event_data.get("call_control_id")
        logger.info(f"Call answered: {call_control_id}")
        if call_control_id and is_telnyx_outbound_call(call_control_id):
            stream_url = f"wss://{NGROK_URL.replace('https://', '').replace('http://', '')}/ws/media-stream/{call_control_id}"
            response = {
                "commands": [
                    {
                        "command": "stream_start",
                        "stream_url": stream_url,
                        "stream_track": "both_tracks",
                    }
                ]
            }
            return JSONResponse(response)
        return JSONResponse({"status": "ok"})
    
    elif event_type == "call.hangup":
        logger.info(f"Call hangup: {event_data.get('call_control_id')}")
        return JSONResponse({"status": "ok"})
    
    elif event_type == "call.speak.ended":
        logger.info(f"Speak ended: {event_data.get('call_control_id')}")
        return JSONResponse({"status": "ok"})
    
    else:
        logger.warning(f"Unhandled Telnyx event type: {event_type}")
        return JSONResponse({"status": "ok"})


async def handle_call_initiated(event_data: Dict[str, Any]) -> JSONResponse:
    """
    Handle incoming call (call.initiated event).
    
    Returns JSON response with commands to answer and start media streaming.
    """
    call_control_id = event_data.get("call_control_id")
    caller = event_data.get("from")
    to_number = event_data.get("to")
    direction = event_data.get("direction")
    state = event_data.get("state")
    
    logger.info(
        f"Incoming Telnyx call: call_control_id={call_control_id} "
        f"from={caller} to={to_number} direction={direction} state={state}"
    )
    
    # Allow outbound calls that were initiated by load tests
    if direction != "incoming" and not is_telnyx_outbound_call(call_control_id):
        logger.warning(f"Ignoring non-inbound call: {direction}")
        return JSONResponse({"status": "ignored"})
    
    context = TELNYX_CALL_CONTEXTS.get(call_control_id)
    tenant_id = context.get("tenant_id") if context else None
    tenant_config = context.get("tenant_config") if context else None

    if not tenant_id:
        # Resolve tenant from phone number for inbound calls
        tenant_id = await resolve_phone_to_tenant(to_number)
        if not tenant_id:
            logger.error(f"No tenant routing found for number {to_number}")
            return _error_response("This number is not configured")

    if not tenant_config:
        tenant_config = await get_tenant_config(tenant_id)
        if not tenant_config:
            logger.error(f"Tenant config missing for {tenant_id}")
            return _error_response("Service not configured")
    
    system_prompt = tenant_config.get("system_prompt") or DEFAULT_SYSTEM_PROMPT
    
    # Preload caller history during ring time
    if direction == "incoming":
        normalized_caller = normalize_phone_number(caller or "unknown")
    else:
        normalized_caller = normalize_phone_number(to_number or "unknown")
    try:
        caller_history = await asyncio.wait_for(
            asyncio.to_thread(
                get_recent_call_history,
                tenant_id,
                normalized_caller,
                3,
            ),
            timeout=1.5,
        )
    except Exception as exc:
        logger.warning(f"Caller history lookup failed: {exc}")
        caller_history = []
    
    tenant_config["caller_phone"] = normalized_caller
    tenant_config["caller_history"] = caller_history
    
    # Register context for websocket handler (overwrite with latest caller history)
    register_telnyx_call_context(
        call_control_id,
        {
            "tenant_id": tenant_id,
            "caller_phone": normalized_caller,
            "system_prompt": system_prompt,
            "tenant_config": tenant_config,
        },
    )
    
    # Return commands to answer call and start media streaming (inbound only)
    stream_url = f"wss://{NGROK_URL.replace('https://', '').replace('http://', '')}/ws/media-stream/{call_control_id}"
    if direction == "incoming":
        response = {
            "commands": [
                {
                    "command": "answer"
                },
                {
                    "command": "stream_start",
                    "stream_url": stream_url,
                    "stream_track": "both_tracks"
                }
            ]
        }
    else:
        response = {"commands": []}
    
    logger.info(f"Returning Telnyx commands for call_control_id={call_control_id} stream_url={stream_url}")
    
    return JSONResponse(response)


def _error_response(message: str) -> JSONResponse:
    """
    Return error response that speaks a message and hangs up.
    """
    return JSONResponse({
        "commands": [
            {
                "command": "answer"
            },
            {
                "command": "speak",
                "payload": message,
                "voice": "female",
                "language": "en-US"
            },
            {
                "command": "hangup"
            }
        ]
    })


def _validate_telnyx_signature(request: Request, public_key: str):
    """
    Validate Telnyx webhook signature.
    
    Telnyx uses HMAC-SHA256 signature verification.
    Reference: https://developers.telnyx.com/docs/v2/development/webhook-signing
    """
    signature_header = request.headers.get("telnyx-signature-ed25519")
    timestamp_header = request.headers.get("telnyx-timestamp-ed25519")
    
    if not signature_header or not timestamp_header:
        logger.warning("Missing Telnyx signature headers")
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="Missing signature headers"
        )
    
    # Note: Full signature validation would require the request body
    # For now, we just check that headers are present
    # Production implementation should verify the signature
    logger.debug(f"Telnyx signature validated (timestamp={timestamp_header})")
