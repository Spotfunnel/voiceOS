"""
Bot Runner - Simple HTTP server to start/stop voice calls

Endpoints:
- POST /start_call: Start a voice call
- POST /stop_call: Stop a voice call
- GET /health: Health check

Usage:
    python bot_runner.py
"""

import os
import asyncio
import logging
from typing import Dict, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from pipecat.pipeline.task import PipelineTask
from pipecat.pipeline.runner import PipelineRunner
from pipecat.transports.services.daily import DailyParams, DailyTransport

from minimal_pipeline import create_pipeline

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="Minimal Voice AI", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active calls
active_calls: Dict[str, PipelineTask] = {}


class StartCallRequest(BaseModel):
    """Request to start a voice call"""
    call_id: str
    room_url: str
    token: str


class StopCallRequest(BaseModel):
    """Request to stop a voice call"""
    call_id: str


@app.post("/start_call")
async def start_call(request: StartCallRequest):
    """
    Start a voice call.
    
    Args:
        call_id: Unique call identifier
        room_url: Daily.co room URL (e.g., https://your-domain.daily.co/room-name)
        token: Daily.co room token
        
    Returns:
        JSON response with call status
        
    Example:
        curl -X POST http://localhost:8000/start_call \
          -H "Content-Type: application/json" \
          -d '{
            "call_id": "test-001",
            "room_url": "https://your-domain.daily.co/room",
            "token": "your-token"
          }'
    """
    # Check if call is already active
    if request.call_id in active_calls:
        raise HTTPException(
            status_code=400,
            detail=f"Call {request.call_id} is already active"
        )
    
    logger.info(f"Starting call {request.call_id}")
    logger.info(f"Room URL: {request.room_url}")
    
    try:
        # Create Daily.co transport
        transport = DailyTransport(
            request.room_url,
            request.token,
            "Receptionist Bot",
            DailyParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                transcription_enabled=False,
                vad_enabled=True,
                vad_analyzer=None,  # Use Daily's default VAD
            )
        )
        
        # Create pipeline
        pipeline = create_pipeline(
            transport_input=transport.input(),
            transport_output=transport.output(),
        )
        
        # Create task and runner
        task = PipelineTask(pipeline)
        runner = PipelineRunner()
        
        # Store active call
        active_calls[request.call_id] = task
        
        # Run pipeline in background
        async def run_pipeline():
            try:
                logger.info(f"Pipeline starting for call {request.call_id}")
                await runner.run(task)
                logger.info(f"Pipeline finished for call {request.call_id}")
            except Exception as e:
                logger.error(f"Pipeline error for call {request.call_id}: {e}")
                raise
            finally:
                # Clean up
                active_calls.pop(request.call_id, None)
                logger.info(f"Call {request.call_id} cleaned up")
        
        # Start pipeline
        asyncio.create_task(run_pipeline())
        
        logger.info(f"Call {request.call_id} started successfully")
        
        return JSONResponse({
            "status": "started",
            "call_id": request.call_id,
            "room_url": request.room_url,
        })
        
    except Exception as e:
        logger.error(f"Failed to start call {request.call_id}: {e}")
        active_calls.pop(request.call_id, None)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/stop_call")
async def stop_call(request: StopCallRequest):
    """
    Stop a voice call.
    
    Args:
        call_id: Unique call identifier
        
    Returns:
        JSON response with call status
        
    Example:
        curl -X POST http://localhost:8000/stop_call \
          -H "Content-Type: application/json" \
          -d '{"call_id": "test-001"}'
    """
    # Check if call exists
    if request.call_id not in active_calls:
        raise HTTPException(
            status_code=404,
            detail=f"Call {request.call_id} not found"
        )
    
    logger.info(f"Stopping call {request.call_id}")
    
    try:
        # Get task
        task = active_calls[request.call_id]
        
        # Cancel task
        await task.cancel()
        
        # Remove from active calls
        active_calls.pop(request.call_id, None)
        
        logger.info(f"Call {request.call_id} stopped successfully")
        
        return JSONResponse({
            "status": "stopped",
            "call_id": request.call_id,
        })
        
    except Exception as e:
        logger.error(f"Failed to stop call {request.call_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """
    Health check endpoint.
    
    Returns:
        JSON response with service status
        
    Example:
        curl http://localhost:8000/health
    """
    return JSONResponse({
        "status": "healthy",
        "active_calls": len(active_calls),
        "call_ids": list(active_calls.keys()),
    })


@app.get("/")
async def root():
    """Root endpoint with API documentation"""
    return JSONResponse({
        "service": "Minimal Voice AI",
        "version": "1.0.0",
        "endpoints": {
            "start_call": "POST /start_call",
            "stop_call": "POST /stop_call",
            "health": "GET /health",
        },
        "docs": "/docs",
    })


if __name__ == "__main__":
    import uvicorn
    
    # Get configuration from environment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    
    # Validate required environment variables
    required_env_vars = [
        "DEEPGRAM_API_KEY",
        "GOOGLE_API_KEY",
        "CARTESIA_API_KEY",
    ]
    
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        logger.error("Please create a .env file with these variables")
        exit(1)
    
    logger.info("=" * 50)
    logger.info("Minimal Voice AI Bot Runner")
    logger.info("=" * 50)
    logger.info(f"Starting server on {host}:{port}")
    logger.info(f"API docs: http://{host}:{port}/docs")
    logger.info("=" * 50)
    
    # Run server
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
    )
