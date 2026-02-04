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
from typing import Dict, Optional, Set
from datetime import datetime
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask

from .transports.daily_transport import DailyTransportWrapper
from .transports.twilio_transport import TwilioTransportWrapper
from .pipeline.voice_pipeline import build_voice_pipeline
from .events.event_emitter import EventEmitter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Voice Core Bot Runner", version="1.0.0")
DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant for SpotFunnel."

# Global state
active_calls: Dict[str, PipelineTask] = {}  # call_id -> PipelineTask
event_emitter = EventEmitter()
websocket_connections: Set[WebSocket] = set()
shutdown_requested = False


class StartCallRequest(BaseModel):
    """Request to start a voice bot call"""
    call_id: str
    transport: str  # "daily" or "twilio"
    room_url: Optional[str] = None  # For Daily.co
    token: Optional[str] = None  # For Daily.co
    call_sid: Optional[str] = None  # For Twilio


class StopCallRequest(BaseModel):
    """Request to stop a voice bot call"""
    call_id: str


@app.post("/start_call")
async def start_call(request: StartCallRequest):
    """
    Start voice bot for a call.
    
    Request body:
        call_id: Unique call identifier
        transport: "daily" or "twilio"
        room_url: Daily.co room URL (required for Daily)
        token: Daily.co token (required for Daily)
        call_sid: Twilio call SID (required for Twilio)
        system_prompt: Optional system prompt for LLM
        
    Returns:
        JSON response with call status
    """
    if request.call_id in active_calls:
        raise HTTPException(status_code=400, detail=f"Call {request.call_id} already active")
    
    if shutdown_requested:
        raise HTTPException(status_code=503, detail="Service shutting down, not accepting new calls")
    
    try:
        # Create transport based on type
        if request.transport == "daily":
            if not request.room_url or not request.token:
                raise HTTPException(status_code=400, detail="room_url and token required for Daily.co")
            
            transport = DailyTransportWrapper(
                room_url=request.room_url,
                token=request.token,
                event_emitter=event_emitter,
            )
            
        elif request.transport == "twilio":
            if not request.call_sid:
                raise HTTPException(status_code=400, detail="call_sid required for Twilio")
            
            transport = TwilioTransportWrapper.from_env(event_emitter=event_emitter)
            
        else:
            raise HTTPException(status_code=400, detail=f"Invalid transport: {request.transport}")
        
        # Build voice pipeline
        pipeline = build_voice_pipeline(
            transport_input=transport.input(),
            transport_output=transport.output(),
            event_emitter=event_emitter,
            system_prompt=DEFAULT_SYSTEM_PROMPT
        )
        
        # Create pipeline task
        task = PipelineTask(pipeline)
        
        # Start transport
        if request.transport == "daily":
            await transport.start()
        elif request.transport == "twilio":
            await transport.start(call_sid=request.call_sid)
        
        # Run pipeline in background
        runner = PipelineRunner()
        asyncio.create_task(runner.run(task))
        
        # Track active call
        active_calls[request.call_id] = task
        
        # Emit call started event
        await event_emitter.emit("call_started", {
            "call_id": request.call_id,
            "transport": request.transport,
            "timestamp": datetime.now().isoformat(),
        })
        
        logger.info(f"Started call {request.call_id} on {request.transport} transport")
        
        return JSONResponse({
            "status": "started",
            "call_id": request.call_id,
            "transport": request.transport,
        })
        
    except Exception as e:
        logger.error(f"Failed to start call {request.call_id}: {e}")
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
        task = active_calls[request.call_id]
        
        # Cancel task
        await task.cancel()
        
        # Remove from active calls
        del active_calls[request.call_id]
        
        # Emit call ended event
        await event_emitter.emit("call_ended", {
            "call_id": request.call_id,
            "timestamp": datetime.now().isoformat(),
        })
        
        logger.info(f"Stopped call {request.call_id}")
        
        return JSONResponse({
            "status": "stopped",
            "call_id": request.call_id,
        })
        
    except Exception as e:
        logger.error(f"Failed to stop call {request.call_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
            for call_id, task in list(active_calls.items()):
                try:
                    await task.cancel()
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
