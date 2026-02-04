"\"\"\""
"Twilio webhook handler for automatic call routing."
"\"\"\""

import asyncio
import base64
import hashlib
import hmac
import logging
import os
from typing import Dict, List

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from starlette.status import HTTP_400_BAD_REQUEST, HTTP_403_FORBIDDEN

from ..services.call_initiator import start_bot_call
from ..services.phone_routing import get_tenant_config, resolve_phone_to_tenant

logger = logging.getLogger(__name__)
router = APIRouter()

DEFAULT_SYSTEM_PROMPT = os.getenv(
    "TWILIO_SYSTEM_PROMPT",
    "You are a helpful AI assistant for SpotFunnel."
)
MEDIA_STREAM_BASE_URL = os.getenv(
    "TWILIO_MEDIA_STREAM_URL",
    "wss://your-server.com/ws/media-stream"
)


@router.post("/twilio/voice")
async def twilio_voice_webhook(request: Request):
    """
    Handle incoming Twilio voice webhook and route the call to a bot.
    """
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    if not auth_token:
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail="TWILIO_AUTH_TOKEN is not configured"
        )

    form_data = await request.form()
    form_params = _normalize_form(form_data)
    _validate_twilio_signature(request, auth_token, form_params)

    call_sid = _get_single_value(form_params, "CallSid")
    caller = _get_single_value(form_params, "From")
    to_number = _get_single_value(form_params, "To")
    call_status = _get_single_value(form_params, "CallStatus")
    direction = _get_single_value(form_params, "Direction")

    logger.info(
        "Incoming Twilio call: CallSid=%s From=%s To=%s Status=%s Direction=%s",
        call_sid,
        caller,
        to_number,
        call_status,
        direction,
    )

    if direction != "inbound" or call_status != "ringing":
        logger.warning(
            "Ignoring Twilio call in invalid state: %s/%s", direction, call_status
        )
        return Response(
            content=_get_error_twiml("Call not in a connectable state"),
            media_type="application/xml"
        )

    tenant_id = await resolve_phone_to_tenant(to_number)
    if not tenant_id:
        logger.error("No tenant routing found for number %s", to_number)
        return Response(
            content=_get_error_twiml("This number is not configured"),
            media_type="application/xml"
        )

    tenant_config = await get_tenant_config(tenant_id)
    if not tenant_config:
        logger.error("Tenant config missing for %s", tenant_id)
        return Response(
            content=_get_error_twiml("Service not configured"),
            media_type="application/xml"
        )

    system_prompt = tenant_config.get("system_prompt") or DEFAULT_SYSTEM_PROMPT

    # Fire-and-forget start call so Twilio webhook can respond quickly
    asyncio.create_task(
        start_bot_call(
            call_sid=call_sid,
            tenant_id=tenant_id,
            caller_phone=caller,
            config=tenant_config,
            system_prompt=system_prompt,
        )
    )

    websocket_url = _get_websocket_url(call_sid)
    twiml = _get_stream_twiml(websocket_url)

    logger.info("Returning TwiML for CallSid=%s Stream=%s", call_sid, websocket_url)

    return Response(content=twiml, media_type="application/xml")


def _normalize_form(form_data) -> Dict[str, List[str]]:
    normalized: Dict[str, List[str]] = {}
    for key, value in form_data.multi_items():
        normalized.setdefault(key, []).append(str(value))
    return normalized


def _get_single_value(form_params: Dict[str, List[str]], key: str) -> str:
    values = form_params.get(key)
    if not values:
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Missing Twilio field: {key}"
        )
    return values[0]


def _validate_twilio_signature(
    request: Request,
    auth_token: str,
    form_params: Dict[str, List[str]],
):
    expected_signature = _compute_twilio_signature(
        auth_token=auth_token,
        url=str(request.url),
        params=form_params,
    )

    incoming_signature = request.headers.get("X-Twilio-Signature")
    if not incoming_signature:
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="Missing X-Twilio-Signature header",
        )

    if not hmac.compare_digest(expected_signature, incoming_signature):
        logger.warning(
            "Invalid Twilio signature: expected=%s received=%s",
            expected_signature,
            incoming_signature,
        )
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="Invalid Twilio signature",
        )


def _compute_twilio_signature(
    auth_token: str,
    url: str,
    params: Dict[str, List[str]],
) -> str:
    data = url
    for key in sorted(params.keys()):
        for value in params[key]:
            data += f"{key}{value}"
    mac = hmac.new(auth_token.encode(), data.encode("utf-8"), hashlib.sha1)
    return base64.b64encode(mac.digest()).decode()


def _get_websocket_url(call_sid: str) -> str:
    base = MEDIA_STREAM_BASE_URL.rstrip("/")
    separator = "&" if "?" in base else "?"
    return f"{base}{separator}call_sid={call_sid}"


def _get_stream_twiml(websocket_url: str) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="{websocket_url}" />
    </Connect>
</Response>"""


def _get_error_twiml(message: str) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Nicole">{message}</Say>
    <Hangup/>
</Response>"""
