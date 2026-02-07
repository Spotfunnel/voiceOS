"""
Bot Runner - HTTP service to start/stop voice bots

Endpoints:
- POST /start_call: Start voice bot for a call
- POST /stop_call: Stop voice bot for a call
- WebSocket /ws/call_events: Stream call events
- GET /health: Health check

Features:
- Graceful shutdown (finish active calls before exit)
- Call lifecycle management
- Event streaming via WebSocket
- Non-blocking recording uploads

Architecture compliance:
- Non-blocking I/O (recordings queued for background upload)
- Circuit breakers for TTS providers
- Event emission for observability
"""

import os
import asyncio
from dataclasses import dataclass, field
from typing import Dict, Optional, Set, Any, List
from datetime import datetime
import logging
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketTransport,
    FastAPIWebsocketParams,
)
from pipecat.serializers.telnyx import TelnyxFrameSerializer

from .transports.daily_transport import DailyTransportWrapper
from .transports.telnyx_transport import TelnyxTransportWrapper
from .pipeline.voice_pipeline import build_voice_pipeline
from .pipeline.objective_graph_pipeline import build_objective_graph_pipeline
from .events.event_emitter import EventEmitter, VoiceCoreEvent
from .llm import AllLLMProvidersFailed
from .tts.multi_provider_tts import AllTTSProvidersFailed
from .services.error_tracking import log_system_error
from .services.error_monitoring import init_error_monitoring
from .services.session_cleanup import start_session_cleanup_task
from .services.telnyx_fallback import TelnyxFallbackService
from .pipeline.error_handlers import PipelineErrorHandler
from .middleware.rate_limit import RateLimitMiddleware
from .services.phone_routing import get_tenant_config
from .api.telnyx_webhook import (
    router as telnyx_router,
    pop_telnyx_call_context,
    register_telnyx_call_context,
    register_telnyx_outbound_call,
)
from .api.tenant_config import router as tenant_config_router
from .api.onboarding import router as onboarding_router
from .api.dashboard import router as dashboard_router
from .api.stress_test import router as stress_test_router
from .api.call_transfer import router as call_transfer_router
from .api.knowledge_bases import router as knowledge_bases_router
from .api.call_history import router as call_history_router
from .api.admin.operations import router as admin_operations_router
from .api.admin.provisioning import router as admin_provisioning_router
from .api.admin.configure import router as admin_configure_router
from .api.admin.quality import router as admin_quality_router
from .api.admin.intelligence import router as admin_intelligence_router
from .api.auth import router as auth_router, admin_router as auth_admin_router
from .api.admin_agents import router as admin_agents_router
from .api.calls import router as calls_router
from .api.dashboard import broadcast_call_event
from .database.db_service import get_db_service
from .services.call_history import insert_call_summary
from .services.phone_routing import normalize_phone_number
from .services.telnyx_call_control import create_call as telnyx_create_call

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Voice Core Bot Runner", version="1.0.0")
init_error_monitoring()

# CORS configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3001").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)
logger.info("CORS enabled for origins: %s", allowed_origins)

# Rate limiting
if os.getenv("ENABLE_RATE_LIMITING", "true").lower() == "true":
    rate_limit_requests = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
    rate_limit_period = int(os.getenv("RATE_LIMIT_PERIOD", "60"))
    app.add_middleware(
        RateLimitMiddleware,
        requests_per_period=rate_limit_requests,
        period_seconds=rate_limit_period,
    )
    logger.info(
        "Rate limiting enabled: %s req/%ss",
        rate_limit_requests,
        rate_limit_period,
    )
app.include_router(telnyx_router, prefix="/api", tags=["webhooks"])
app.include_router(tenant_config_router)
app.include_router(onboarding_router)
app.include_router(dashboard_router)
app.include_router(admin_operations_router)
app.include_router(admin_provisioning_router)
app.include_router(admin_configure_router)
app.include_router(admin_quality_router)
app.include_router(admin_intelligence_router)
app.include_router(auth_router)
app.include_router(auth_admin_router)
app.include_router(admin_agents_router)
app.include_router(calls_router)
app.include_router(stress_test_router)
app.include_router(call_transfer_router)
app.include_router(knowledge_bases_router)
app.include_router(call_history_router)
DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant for SpotFunnel."

# Global state
@dataclass
class ActiveCall:
    task: PipelineTask
    pipeline: Any
    runner: PipelineRunner
    transport: str
    call_sid: Optional[str] = None


active_calls: Dict[str, ActiveCall] = {}
event_emitter = EventEmitter()
websocket_connections: Set[WebSocket] = set()
shutdown_requested = False
telnyx_fallback = TelnyxFallbackService()


@dataclass
class CallLogContext:
    call_id: str
    tenant_id: Optional[str]
    caller_phone: str
    start_time: datetime
    end_time: Optional[datetime] = None
    call_sid: Optional[str] = None
    transcript_parts: List[str] = field(default_factory=list)
    captured_data: Dict[str, Any] = field(default_factory=dict)
    requires_action: bool = False
    priority: str = "low"
    outcome: str = "in_progress"
    status: str = "in_progress"
    stt_cost_usd: Optional[float] = None
    llm_cost_usd: Optional[float] = None
    tts_cost_usd: Optional[float] = None
    total_cost_usd: Optional[float] = None
    event_emitter: Optional[EventEmitter] = None
    summary_written: bool = False

    def transcript(self) -> str:
        return "\n".join(self.transcript_parts).strip()


call_log_contexts: Dict[str, CallLogContext] = {}


def _normalize_captured_data(raw: Dict[str, Any]) -> Dict[str, Any]:
    mapped: Dict[str, Any] = {}
    for key, value in raw.items():
        lowered = key.lower()
        if "email" in lowered:
            mapped["email"] = value
        elif "phone" in lowered:
            mapped["phone"] = value
        elif "name" in lowered:
            mapped["name"] = value
        elif "service" in lowered:
            mapped["service"] = value
        elif "datetime" in lowered or "time" in lowered:
            mapped["datetime"] = value
        elif "summary" in lowered:
            mapped["summary"] = value
        else:
            mapped[key] = value
    return mapped


def _finalize_outcome(context: CallLogContext) -> str:
    if context.outcome == "failed":
        return "failed"
    if context.requires_action:
        return "callback_requested"
    if context.captured_data:
        return "lead_captured"
    return "faq_resolved"


def _extract_costs_from_pipeline(pipeline) -> Dict[str, float]:
    trackers = getattr(pipeline, "cost_trackers", {}) or {}
    llm_cost = 0.0
    tts_cost = 0.0
    if trackers.get("llm") and hasattr(trackers["llm"], "get_total_cost"):
        llm_cost = float(trackers["llm"].get_total_cost() or 0.0)
    if trackers.get("tts") and hasattr(trackers["tts"], "get_total_cost"):
        tts_cost = float(trackers["tts"].get_total_cost() or 0.0)
    return {
        "llm_cost_usd": llm_cost,
        "tts_cost_usd": tts_cost,
        "stt_cost_usd": 0.0,
        "total_cost_usd": llm_cost + tts_cost,
    }


async def _persist_call_log(context: CallLogContext) -> None:
    if not context.tenant_id:
        return
    db_service = get_db_service()
    duration_seconds = 0
    if context.end_time:
        duration_seconds = int((context.end_time - context.start_time).total_seconds())
    summary = context.captured_data.get("summary")
    reason_for_calling = (
        context.captured_data.get("reason_for_calling")
        or context.captured_data.get("reason")
        or context.captured_data.get("reasonForCalling")
    )
    await asyncio.to_thread(
        db_service.upsert_call_log,
        call_id=context.call_id,
        tenant_id=context.tenant_id,
        caller_phone=context.caller_phone,
        start_time=context.start_time,
        end_time=context.end_time,
        duration_seconds=duration_seconds,
        outcome=context.outcome,
        transcript=context.transcript(),
        summary=summary,
        reason_for_calling=reason_for_calling,
        captured_data=context.captured_data,
        requires_action=context.requires_action,
        priority=context.priority,
        status=context.status,
        call_sid=context.call_sid,
        stt_cost_usd=context.stt_cost_usd,
        llm_cost_usd=context.llm_cost_usd,
        tts_cost_usd=context.tts_cost_usd,
        total_cost_usd=context.total_cost_usd,
    )


async def _persist_call_history(context: CallLogContext) -> None:
    if not context.tenant_id or context.summary_written:
        return
    if not context.end_time:
        return
    summary = context.captured_data.get("summary")
    if not summary:
        # Fallback to a short snippet of transcript if no summary exists
        transcript = context.transcript()
        summary = transcript[:280].strip() if transcript else None
    if not summary:
        return
    await asyncio.to_thread(
        insert_call_summary,
        tenant_id=context.tenant_id,
        caller_phone=normalize_phone_number(context.caller_phone),
        summary=summary,
        outcome=context.outcome,
        conversation_id=None,
        call_sid=context.call_id,
        started_at=context.start_time.isoformat(),
        ended_at=context.end_time.isoformat(),
    )
    context.summary_written = True


async def _run_pipeline_guarded(call_id: str, task: PipelineTask, runner: PipelineRunner, pipeline) -> None:
    context = call_log_contexts.get(call_id)
    error_handler = PipelineErrorHandler(
        tenant_id=context.tenant_id if context and context.tenant_id else "unknown",
        call_sid=context.call_sid if context and context.call_sid else call_id,
    )

    async def _play_fallback(message: str) -> None:
        if not context or not context.call_sid:
            return
        transfer_contact = await telnyx_fallback.get_transfer_contact(context.tenant_id)
        transfer_phone = transfer_contact.get("phone") if transfer_contact else None
        transfer_name = transfer_contact.get("name", "support") if transfer_contact else "support"
        await telnyx_fallback.play_message_and_transfer(
            call_control_id=context.call_sid,  # call_sid is actually call_control_id for Telnyx
            message=message,
            transfer_phone=transfer_phone,
            transfer_name=transfer_name,
        )

    try:
        await runner.run(task)
    except AllLLMProvidersFailed as exc:
        logger.error("All LLM providers failed for call %s: %s", call_id, exc)
        log_system_error(
            error_type="LLM_PROVIDERS_FAILED",
            error_message=str(exc),
            tenant_id=context.tenant_id if context else None,
            call_id=call_id,
            severity="CRITICAL",
            exception=exc,
        )
        await _play_fallback(error_handler.get_llm_failure_message())
        if context:
            context.outcome = "failed"
            context.status = "failed"
            context.end_time = datetime.utcnow()
            costs = _extract_costs_from_pipeline(pipeline)
            context.llm_cost_usd = costs["llm_cost_usd"]
            context.tts_cost_usd = costs["tts_cost_usd"]
            context.stt_cost_usd = costs["stt_cost_usd"]
            context.total_cost_usd = costs["total_cost_usd"]
            await _persist_call_log(context)
    except AllTTSProvidersFailed as exc:
        logger.error("All TTS providers failed for call %s: %s", call_id, exc)
        log_system_error(
            error_type="TTS_PROVIDERS_FAILED",
            error_message=str(exc),
            tenant_id=context.tenant_id if context else None,
            call_id=call_id,
            severity="CRITICAL",
            exception=exc,
        )
        await _play_fallback(error_handler.get_tts_failure_message())
        if context:
            context.outcome = "failed"
            context.status = "failed"
            context.end_time = datetime.utcnow()
            costs = _extract_costs_from_pipeline(pipeline)
            context.llm_cost_usd = costs["llm_cost_usd"]
            context.tts_cost_usd = costs["tts_cost_usd"]
            context.stt_cost_usd = costs["stt_cost_usd"]
            context.total_cost_usd = costs["total_cost_usd"]
            await _persist_call_log(context)
    except Exception as exc:
        logger.exception("Pipeline failed for call %s: %s", call_id, exc)
        log_system_error(
            error_type="PIPELINE_ERROR",
            error_message=str(exc),
            tenant_id=context.tenant_id if context else None,
            call_id=call_id,
            severity="ERROR",
            exception=exc,
        )
        await _play_fallback(error_handler.get_generic_error_message())
        if context:
            context.outcome = "failed"
            context.status = "failed"
            context.end_time = datetime.utcnow()
            costs = _extract_costs_from_pipeline(pipeline)
            context.llm_cost_usd = costs["llm_cost_usd"]
            context.tts_cost_usd = costs["tts_cost_usd"]
            context.stt_cost_usd = costs["stt_cost_usd"]
            context.total_cost_usd = costs["total_cost_usd"]
            await _persist_call_log(context)
    finally:
        active_calls.pop(call_id, None)


class StartCallRequest(BaseModel):
    """Request to start a voice bot call"""
    call_id: str
    transport: str  # "daily" or "telnyx"
    room_url: Optional[str] = None  # For Daily.co
    token: Optional[str] = None  # For Daily.co
    call_sid: Optional[str] = None  # Telnyx call_control_id
    tenant_id: Optional[str] = None
    caller_phone: Optional[str] = None
    system_prompt: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    to_number: Optional[str] = None
    from_number: Optional[str] = None


class StopCallRequest(BaseModel):
    """Request to stop a voice bot call"""
    call_id: str


@app.post("/start_call")
async def start_call(request: StartCallRequest):
    """
    Start voice bot for a call.
    
    Request body:
        call_id: Unique call identifier
        transport: "daily" or "telnyx"
        room_url: Daily.co room URL (required for Daily)
        token: Daily.co token (required for Daily)
        call_sid: Telnyx call_control_id (required for Telnyx)
        system_prompt: Optional system prompt for LLM
        
    Returns:
        JSON response with call status
    """
    if request.call_id in active_calls:
        raise HTTPException(status_code=400, detail=f"Call {request.call_id} already active")
    
    if shutdown_requested:
        raise HTTPException(status_code=503, detail="Service shutting down, not accepting new calls")
    
    try:
        call_emitter = EventEmitter(conversation_id=request.call_id)

        async def _forward_event(event: VoiceCoreEvent):
            data = dict(event.data or {})
            data.setdefault("call_id", event.conversation_id)
            await event_emitter.emit(
                event.event_type, data=data, metadata=event.metadata
            )

        async def _call_log_observer(event: VoiceCoreEvent):
            call_id = event.conversation_id or request.call_id
            context = call_log_contexts.get(call_id)
            if not context:
                return
            if event.event_type == "user_spoke":
                text = (event.data or {}).get("text")
                if text:
                    context.transcript_parts.append(f"User: {text}")
            elif event.event_type == "agent_spoke":
                text = (event.data or {}).get("text")
                if text:
                    context.transcript_parts.append(f"Agent: {text}")
            elif event.event_type in ("objective_chain_completed", "objective_chain_failed"):
                captured = (event.data or {}).get("captured_data", {})
                context.captured_data.update(_normalize_captured_data(captured))
                if event.event_type == "objective_chain_failed":
                    context.requires_action = True
                    context.priority = "high"
                    context.outcome = "failed"
                    context.status = "failed"
                await _persist_call_log(context)
            elif event.event_type == "objective_completed":
                value = (event.data or {}).get("value")
                if value:
                    context.captured_data.setdefault("email", value)
                context.outcome = "lead_captured"
                await _persist_call_log(context)
            elif event.event_type == "call_ended":
                context.end_time = datetime.utcnow()
                if context.outcome == "in_progress":
                    context.outcome = _finalize_outcome(context)
                if context.status == "in_progress":
                    context.status = "completed" if context.outcome != "failed" else "failed"
                await _persist_call_log(context)
                await _persist_call_history(context)
                call_log_contexts.pop(call_id, None)

        call_emitter.add_observer(_forward_event)
        call_emitter.add_observer(_call_log_observer)

        caller_phone = request.caller_phone or "unknown"
        call_log_contexts[request.call_id] = CallLogContext(
            call_id=request.call_id,
            tenant_id=request.tenant_id,
            caller_phone=caller_phone,
            start_time=datetime.utcnow(),
            outcome="in_progress",
            status="in_progress",
            call_sid=request.call_sid,
            event_emitter=call_emitter,
        )

        # Create transport based on type
        if request.transport == "daily":
            if not request.room_url or not request.token:
                raise HTTPException(status_code=400, detail="room_url and token required for Daily.co")
            
            transport = DailyTransportWrapper(
                room_url=request.room_url,
                token=request.token,
                event_emitter=call_emitter,
            )
            
        elif request.transport == "telnyx":
            # Telnyx load tests must initiate real calls via Call Control API.
            if not request.to_number:
                raise HTTPException(
                    status_code=400,
                    detail="to_number required for Telnyx call initiation. Inbound calls use /api/telnyx/webhook.",
                )

            connection_id = os.getenv("TELNYX_CONNECTION_ID")
            if not connection_id:
                raise HTTPException(status_code=500, detail="TELNYX_CONNECTION_ID not configured")

            from_number = request.from_number
            if not from_number and request.tenant_id:
                try:
                    db = get_db_service()
                    conn = db.get_connection()
                    cur = conn.cursor(cursor_factory=RealDictCursor)
                    cur.execute(
                        "SELECT telephony FROM tenant_onboarding_settings WHERE tenant_id = %s::uuid",
                        (request.tenant_id,),
                    )
                    row = cur.fetchone()
                    telephony = (row or {}).get("telephony") or {}
                    from_number = telephony.get("telnyx_phone_number") or telephony.get("phone_number")
                finally:
                    cur.close()
                    db.put_connection(conn)

            if not from_number:
                from_number = os.getenv("TELNYX_FROM_NUMBER")

            if not from_number:
                raise HTTPException(
                    status_code=500,
                    detail="from_number required for Telnyx call initiation (set TELNYX_FROM_NUMBER or tenant telephony)",
                )

            webhook_url = f"{os.getenv('NGROK_URL', '').rstrip('/')}/api/telnyx/webhook"
            if not webhook_url.startswith("http"):
                raise HTTPException(status_code=500, detail="NGROK_URL not configured for Telnyx webhook")

            telnyx_response = await telnyx_create_call(
                to_number=request.to_number,
                from_number=from_number,
                connection_id=connection_id,
                webhook_url=webhook_url,
            )
            call_control_id = (telnyx_response.get("data") or {}).get("call_control_id")
            if not call_control_id:
                raise HTTPException(status_code=500, detail="Telnyx call_control_id missing from response")

            tenant_config = request.config
            if tenant_config is None and request.tenant_id:
                tenant_config = await get_tenant_config(request.tenant_id)

            register_telnyx_call_context(
                call_control_id,
                {
                    "tenant_id": request.tenant_id,
                    "caller_phone": request.to_number,
                    "system_prompt": request.system_prompt or DEFAULT_SYSTEM_PROMPT,
                    "tenant_config": tenant_config or {},
                },
            )
            register_telnyx_outbound_call(call_control_id)

            return JSONResponse(
                {
                    "status": "initiated",
                    "call_id": call_control_id,
                    "call_control_id": call_control_id,
                    "transport": "telnyx",
                }
            )
            
        else:
            raise HTTPException(status_code=400, detail=f"Invalid transport: {request.transport}")
        
        tenant_config = request.config
        if tenant_config is None and request.tenant_id:
            tenant_config = await get_tenant_config(request.tenant_id)

        if tenant_config:
            if request.caller_phone:
                tenant_config["caller_phone"] = request.caller_phone
            pipeline = build_objective_graph_pipeline(
                tenant_config=tenant_config,
                transport=transport,
                event_emitter=call_emitter,
            )
        else:
            # Fallback to basic voice pipeline when no tenant config is available
            pipeline = build_voice_pipeline(
                transport_input=transport.input(),
                transport_output=transport.output(),
                event_emitter=call_emitter,
                system_prompt=request.system_prompt or DEFAULT_SYSTEM_PROMPT,
                tenant_id=request.tenant_id,
            )
        
        # Create pipeline task
        task = PipelineTask(pipeline)
        
        # Start transport
        if request.transport == "daily":
            await transport.start()
        elif request.transport == "telnyx":
            await transport.start()
        
        # Run pipeline in background with guard
        runner = PipelineRunner(handle_sigint=False)
        asyncio.create_task(_run_pipeline_guarded(request.call_id, task, runner, pipeline))

        # Track active call
        active_calls[request.call_id] = ActiveCall(
            task=task,
            pipeline=pipeline,
            runner=runner,
            transport=request.transport,
            call_sid=request.call_sid,
        )
        
        context = call_log_contexts.get(request.call_id)
        if context:
            await _persist_call_log(context)
            if request.tenant_id:
                await broadcast_call_event(
                    request.tenant_id,
                    "call_started",
                    request.call_id,
                    updates={"status": "in_progress"},
                )
        
        logger.info(f"Started call {request.call_id} on {request.transport} transport")
        
        return JSONResponse({
            "status": "started",
            "call_id": request.call_id,
            "transport": request.transport,
        })
        
    except Exception as e:
        logger.error(f"Failed to start call {request.call_id}: {e}")
        call_log_contexts.pop(request.call_id, None)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/stop_call")
async def stop_call(request: StopCallRequest):
    """
    Stop voice bot for a call.
    
    Request body:
        call_id: Unique call identifier
        
    Returns:
        JSON response with call status
    """
    if request.call_id not in active_calls:
        raise HTTPException(status_code=404, detail=f"Call {request.call_id} not found")
    
    try:
        # Get pipeline task
        active_call = active_calls[request.call_id]
        task = active_call.task
        
        # Cancel task
        await task.cancel()
        
        # Remove from active calls
        del active_calls[request.call_id]
        
        context = call_log_contexts.get(request.call_id)
        if context:
            context.end_time = datetime.utcnow()
            if context.outcome == "in_progress":
                context.outcome = _finalize_outcome(context)
            if context.status == "in_progress":
                context.status = "completed" if context.outcome != "failed" else "failed"
            costs = _extract_costs_from_pipeline(active_call.pipeline)
            context.llm_cost_usd = costs["llm_cost_usd"]
            context.tts_cost_usd = costs["tts_cost_usd"]
            context.stt_cost_usd = costs["stt_cost_usd"]
            context.total_cost_usd = costs["total_cost_usd"]
            await _persist_call_log(context)
            await _persist_call_history(context)
            if context.tenant_id:
                await broadcast_call_event(
                    context.tenant_id,
                    "call_ended",
                    request.call_id,
                    updates={"outcome": context.outcome},
                )
            call_log_contexts.pop(request.call_id, None)
        
        logger.info(f"Stopped call {request.call_id}")
        
        return JSONResponse({
            "status": "stopped",
            "call_id": request.call_id,
        })
        
    except Exception as e:
        logger.error(f"Failed to stop call {request.call_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/media-stream/{call_control_id}")
async def telnyx_media_stream(websocket: WebSocket, call_control_id: str):
    """
    Telnyx media stream websocket endpoint.
    Accepts Telnyx audio frames and runs the pipeline end-to-end.
    """
    await websocket.accept()

    context = pop_telnyx_call_context(call_control_id)
    if not context:
        await websocket.close(code=1008)
        return

    call_id = call_control_id
    call_emitter = EventEmitter(conversation_id=call_id)

    async def _forward_event(event: VoiceCoreEvent):
        data = dict(event.data or {})
        data.setdefault("call_id", event.conversation_id)
        await event_emitter.emit(event.event_type, data=data, metadata=event.metadata)

    async def _call_log_observer(event: VoiceCoreEvent):
        context = call_log_contexts.get(call_id)
        if not context:
            return
        if event.event_type == "user_spoke":
            text = (event.data or {}).get("text")
            if text:
                context.transcript_parts.append(f"User: {text}")
        elif event.event_type == "agent_spoke":
            text = (event.data or {}).get("text")
            if text:
                context.transcript_parts.append(f"Agent: {text}")
        elif event.event_type in ("objective_chain_completed", "objective_chain_failed"):
            captured = (event.data or {}).get("captured_data", {})
            context.captured_data.update(_normalize_captured_data(captured))
            if event.event_type == "objective_chain_failed":
                context.requires_action = True
                context.priority = "high"
                context.outcome = "failed"
                context.status = "failed"
            await _persist_call_log(context)
        elif event.event_type == "objective_completed":
            value = (event.data or {}).get("value")
            if value:
                context.captured_data.setdefault("email", value)
            context.outcome = "lead_captured"
            await _persist_call_log(context)
        elif event.event_type == "call_ended":
            context.end_time = datetime.utcnow()
            if context.outcome == "in_progress":
                context.outcome = _finalize_outcome(context)
            if context.status == "in_progress":
                context.status = "completed" if context.outcome != "failed" else "failed"
            await _persist_call_log(context)
            await _persist_call_history(context)
            call_log_contexts.pop(call_id, None)

    call_emitter.add_observer(_forward_event)
    call_emitter.add_observer(_call_log_observer)

    class LoggingTelnyxFrameSerializer(TelnyxFrameSerializer):
        async def deserialize(self, data: str | bytes):
            try:
                raw = data.decode("utf-8") if isinstance(data, (bytes, bytearray)) else data
            except Exception:
                raw = "<un-decodable>"
            logger.info("Telnyx WS raw message: %s", raw)
            frame = await super().deserialize(data)
            if frame is None:
                logger.info("Telnyx WS frame: None (unhandled or empty)")
            else:
                logger.info("Telnyx WS frame parsed: %s", frame.__class__.__name__)
            return frame

    params = FastAPIWebsocketParams(
        serializer=LoggingTelnyxFrameSerializer(
            stream_id=call_control_id,
            call_control_id=call_control_id,
            outbound_encoding="PCMU",
            inbound_encoding="PCMU",
            api_key=os.getenv("TELNYX_API_KEY", ""),
        ),
        add_wav_header=False,
    )
    transport = FastAPIWebsocketTransport(websocket=websocket, params=params)

    call_log_contexts[call_id] = CallLogContext(
        call_id=call_id,
        tenant_id=context.get("tenant_id"),
        caller_phone=context.get("caller_phone", "unknown"),
        start_time=datetime.utcnow(),
        outcome="in_progress",
        status="in_progress",
        call_sid=call_control_id,
        event_emitter=call_emitter,
    )

    tenant_config = context.get("tenant_config") or {}
    if context.get("caller_phone"):
        tenant_config["caller_phone"] = context.get("caller_phone")

    if tenant_config:
        pipeline = build_objective_graph_pipeline(
            tenant_config=tenant_config,
            transport=transport,
            event_emitter=call_emitter,
        )
    else:
        pipeline = build_voice_pipeline(
            transport_input=transport.input(),
            transport_output=transport.output(),
            event_emitter=call_emitter,
            system_prompt=context.get("system_prompt") or DEFAULT_SYSTEM_PROMPT,
            tenant_id=context.get("tenant_id"),
        )

    task = PipelineTask(pipeline)
    runner = PipelineRunner(handle_sigint=False)

    active_calls[call_id] = ActiveCall(
        task=task,
        pipeline=pipeline,
        runner=runner,
        transport="telnyx",
        call_sid=call_control_id,
    )

    try:
        await runner.run(task)
    finally:
        active_calls.pop(call_id, None)


@app.websocket("/ws/call_events")
async def websocket_call_events(websocket: WebSocket):
    """
    WebSocket endpoint for streaming call events.
    
    Events:
    - call_started: Call started
    - call_ended: Call ended
    - user_spoke: User transcription
    - agent_spoke: Agent response
    - objective_completed: Objective completed
    """
    await websocket.accept()
    websocket_connections.add(websocket)
    
    # Subscribe to event emitter
    async def event_handler(event_name: str, data: dict):
        """Forward events to WebSocket"""
        try:
            await websocket.send_json({
                "event": event_name,
                "data": data,
                "timestamp": datetime.now().isoformat(),
            })
        except Exception as e:
            logger.error(f"Failed to send event to WebSocket: {e}")
    
    event_emitter.on("call_started", event_handler)
    event_emitter.on("call_ended", event_handler)
    event_emitter.on("user_spoke", event_handler)
    event_emitter.on("agent_spoke", event_handler)
    event_emitter.on("objective_completed", event_handler)
    
    try:
        # Keep connection alive
        while True:
            # Receive messages (ping/pong)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    finally:
        websocket_connections.discard(websocket)
        # Unsubscribe from events
        event_emitter.off("call_started", event_handler)
        event_emitter.off("call_ended", event_handler)
        event_emitter.off("user_spoke", event_handler)
        event_emitter.off("agent_spoke", event_handler)
        event_emitter.off("objective_completed", event_handler)


@app.get("/health")
async def health_check():
    """
    Health check endpoint.
    
    Returns:
        JSON response with service status
    """
    return JSONResponse({
        "status": "healthy",
        "active_calls": len(active_calls),
        "websocket_connections": len(websocket_connections),
        "shutdown_requested": shutdown_requested,
    })


@app.on_event("startup")
async def startup_event():
    logger.info("Voice Core starting up...")
    start_session_cleanup_task()


@app.on_event("shutdown")
async def graceful_shutdown():
    """
    Graceful shutdown: finish active calls before exiting.
    
    Reference: production-failure-prevention.md - "Memory Threshold Monitoring"
    """
    global shutdown_requested
    shutdown_requested = True
    
    logger.info(f"Graceful shutdown initiated. Active calls: {len(active_calls)}")
    
    # Wait for active calls to complete (max 30 minutes)
    timeout = 1800  # 30 minutes
    start_time = asyncio.get_event_loop().time()
    
    while active_calls:
        elapsed = asyncio.get_event_loop().time() - start_time
        if elapsed >= timeout:
            logger.warning(f"Shutdown timeout reached. Forcefully stopping {len(active_calls)} calls")
            
            # Force stop remaining calls
            for call_id, active_call in list(active_calls.items()):
                try:
                    await active_call.task.cancel()
                except Exception as e:
                    logger.error(f"Failed to cancel call {call_id}: {e}")
            
            break
        
        logger.info(f"Waiting for {len(active_calls)} calls to complete... ({elapsed:.1f}s elapsed)")
        await asyncio.sleep(5)
    
    logger.info("Graceful shutdown complete")


if __name__ == "__main__":
    import uvicorn
    
    # Get port from environment or default to 8000
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting Bot Runner on {host}:{port}")
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
    )
