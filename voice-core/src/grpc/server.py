"""
gRPC Server for Voice Core (Layer 1)

Serves ExecutePrimitive RPC and streams events to Orchestration (Layer 2).
"""

import asyncio
import json
import logging
import time
from typing import AsyncIterator, Optional
from datetime import datetime

import grpc
from grpc import aio

from ..primitives.base import CaptureResult
from ..primitives.capture_email_au import CaptureEmailAU
from .primitive_registry import PrimitiveRegistry
from ..events.event_emitter import EventEmitter, VoiceCoreEvent

# Import generated gRPC stubs (will be generated from proto file)
# For now, we'll define the structure manually until proto compilation is set up
try:
    from voice_core.grpc import voice_core_pb2, voice_core_pb2_grpc
except ImportError:
    # Fallback: define minimal message classes for development
    # In production, these will be generated from proto file
    logging.warning("gRPC stubs not found. Using fallback definitions.")
    
    class voice_core_pb2:
        class ExecutePrimitiveRequest:
            def __init__(self):
                self.objective_type = ""
                self.params = {}
                self.conversation_id = ""
                self.trace_id = ""
                self.purpose = ""
                self.metadata = {}
                self.timeout_seconds = 30
        
        class ExecutePrimitiveResponse:
            def __init__(self):
                self.success = False
                self.data = {}
                self.error = None
                self.metadata = None
        
        class Error:
            def __init__(self):
                self.code = ""
                self.message = ""
                self.details = ""
        
        class ExecutionMetadata:
            def __init__(self):
                self.duration_ms = 0
                self.retry_count = 0
                self.confidence = 0.0
                self.state = ""
        
        class StreamEventsRequest:
            def __init__(self):
                self.conversation_id = ""
                self.trace_id = ""
                self.event_types = []
        
        class Event:
            def __init__(self):
                self.event_type = ""
                self.timestamp = ""
                self.conversation_id = ""
                self.trace_id = ""
                self.data = ""
                self.metadata = {}
        
        class HealthCheckRequest:
            def __init__(self):
                self.service = ""
        
        class HealthCheckResponse:
            SERVING = 1
            NOT_SERVING = 2
            UNKNOWN = 0
            
            def __init__(self):
                self.status = 1
                self.message = ""
    
    class voice_core_pb2_grpc:
        class VoiceCoreServiceServicer:
            pass
        
        @staticmethod
        def add_VoiceCoreServiceServicer_to_server(servicer, server):
            """Mock add servicer method"""
            pass

logger = logging.getLogger(__name__)


class VoiceCoreServiceServicer(voice_core_pb2_grpc.VoiceCoreServiceServicer):
    """
    gRPC service implementation for Voice Core.
    
    Handles:
    - ExecutePrimitive: Execute capture primitives
    - StreamEvents: Stream events from primitive execution
    - HealthCheck: Health check endpoint
    """
    
    def __init__(self):
        """Initialize gRPC service"""
        self.active_executions: dict[str, dict] = {}  # conversation_id -> execution info
        self.event_streams: dict[str, list] = {}  # conversation_id -> event queue
    
    async def ExecutePrimitive(
        self,
        request: voice_core_pb2.ExecutePrimitiveRequest,
        context: aio.ServicerContext
    ) -> voice_core_pb2.ExecutePrimitiveResponse:
        """
        Execute a primitive (e.g., capture_email_au).
        
        Args:
            request: ExecutePrimitiveRequest with objective_type and params
            context: gRPC context (for metadata, cancellation, etc.)
            
        Returns:
            ExecutePrimitiveResponse with result or error
        """
        start_time = time.time()
        trace_id = request.trace_id or "unknown"
        conversation_id = request.conversation_id or "unknown"
        
        # Extract trace_id from metadata if not in request
        if not trace_id or trace_id == "unknown":
            metadata = dict(context.invocation_metadata())
            trace_id = metadata.get("trace-id") or metadata.get("x-trace-id") or trace_id
        
        logger.info(
            f"[{trace_id}] ExecutePrimitive: {request.objective_type} "
            f"(conversation={conversation_id})"
        )
        
        try:
            # Get timeout from request or default to 30s
            timeout_seconds = request.timeout_seconds or 30
            
            # Create event emitter for this execution
            event_emitter = EventEmitter(conversation_id=conversation_id)
            
            # Set up event streaming
            if conversation_id not in self.event_streams:
                self.event_streams[conversation_id] = []
            
            # Add event observer to stream events
            def event_observer(event: VoiceCoreEvent):
                """Observer that adds events to stream queue"""
                if conversation_id in self.event_streams:
                    self.event_streams[conversation_id].append(event)
            
            event_emitter.add_observer(event_observer)
            
            # Get primitive from registry
            primitive = PrimitiveRegistry.create_primitive(
                objective_type=request.objective_type,
                locale=request.params.get("locale", "en-AU"),
                max_retries=int(request.params.get("max_retries", "3"))
            )
            
            if primitive is None:
                return voice_core_pb2.ExecutePrimitiveResponse(
                    success=False,
                    error=voice_core_pb2.Error(
                        code="PRIMITIVE_NOT_FOUND",
                        message=f"Primitive not found: {request.objective_type}",
                        details=json.dumps({"available_primitives": PrimitiveRegistry.list_primitives()})
                    )
                )
            
            # Emit primitive started event
            await event_emitter.emit(
                "primitive_started",
                data={
                    "objective_type": request.objective_type,
                    "purpose": request.purpose,
                },
                metadata={"trace_id": trace_id}
            )
            
            # Execute primitive with timeout
            try:
                # For now, we'll simulate execution since primitives need transcription input
                # In real implementation, this would integrate with the audio pipeline
                result = await asyncio.wait_for(
                    self._execute_primitive_with_transcription(
                        primitive,
                        request,
                        event_emitter
                    ),
                    timeout=timeout_seconds
                )
            except asyncio.TimeoutError:
                logger.warning(f"[{trace_id}] Primitive execution timeout after {timeout_seconds}s")
                return voice_core_pb2.ExecutePrimitiveResponse(
                    success=False,
                    error=voice_core_pb2.Error(
                        code="TIMEOUT",
                        message=f"Primitive execution exceeded {timeout_seconds}s timeout",
                    ),
                    metadata=voice_core_pb2.ExecutionMetadata(
                        duration_ms=int((time.time() - start_time) * 1000),
                        retry_count=primitive.state_machine.retry_count,
                    )
                )
            
            # Build response
            duration_ms = int((time.time() - start_time) * 1000)
            
            response = voice_core_pb2.ExecutePrimitiveResponse(
                success=result.success,
                metadata=voice_core_pb2.ExecutionMetadata(
                    duration_ms=duration_ms,
                    retry_count=result.retry_count,
                    confidence=result.confidence or 0.0,
                    state=result.state.value if hasattr(result.state, 'value') else str(result.state)
                )
            )
            
            if result.success and result.value:
                # Convert result to proto map
                # For email capture, result.value is the email string
                if request.objective_type == "capture_email_au":
                    response.data["email"] = result.value
                elif request.objective_type == "capture_phone_au":
                    response.data["phone"] = result.value
                else:
                    response.data["value"] = result.value
                
                # Add any metadata from result
                if result.metadata:
                    for key, value in result.metadata.items():
                        response.data[f"metadata_{key}"] = str(value)
            else:
                # Build error response
                error_code = "EXECUTION_FAILED"
                error_message = "Primitive execution failed"
                
                if result.state.value == "failed":
                    error_code = "MAX_RETRIES_EXCEEDED"
                    error_message = f"Failed after {result.retry_count} retries"
                
                response.success = False
                response.error = voice_core_pb2.Error(
                    code=error_code,
                    message=error_message,
                    details=json.dumps(result.metadata or {})
                )
            
            # Emit primitive completed event
            await event_emitter.emit(
                "primitive_completed",
                data={
                    "objective_type": request.objective_type,
                    "success": result.success,
                    "duration_ms": duration_ms,
                },
                metadata={"trace_id": trace_id}
            )
            
            logger.info(
                f"[{trace_id}] ExecutePrimitive completed: "
                f"success={result.success}, duration={duration_ms}ms"
            )
            
            return response
            
        except Exception as e:
            logger.exception(f"[{trace_id}] Error executing primitive: {e}")
            duration_ms = int((time.time() - start_time) * 1000)
            
            return voice_core_pb2.ExecutePrimitiveResponse(
                success=False,
                error=voice_core_pb2.Error(
                    code="INTERNAL_ERROR",
                    message=str(e),
                    details=json.dumps({"error_type": type(e).__name__})
                ),
                metadata=voice_core_pb2.ExecutionMetadata(duration_ms=duration_ms)
            )
    
    async def _execute_primitive_with_transcription(
        self,
        primitive: BaseCaptureObjective,
        request: voice_core_pb2.ExecutePrimitiveRequest,
        event_emitter: EventEmitter
    ) -> CaptureResult:
        """
        Execute primitive with transcription input.
        
        For integration test, we'll simulate transcription input from params.
        In production, this would integrate with the audio pipeline.
        """
        # Start primitive execution
        await primitive.execute()
        
        # Check if we have transcription in params (for testing)
        transcription = request.params.get("transcription")
        if transcription:
            # Process transcription
            confidence = float(request.params.get("confidence", "0.85"))
            result = await primitive.process_transcription(transcription, confidence=confidence)
            
            if result:
                return result
            
            # If still in progress, simulate confirmation
            if primitive.state_machine.state.value == "confirming":
                # Simulate user affirmation
                confirmation_text = request.params.get("confirmation", "yes")
                result = await primitive.process_transcription(confirmation_text, confidence=0.9)
                
                if result:
                    return result
        
        # Return current result
        return CaptureResult(
            success=(primitive.state_machine.state.value == "completed"),
            value=primitive.state_machine.captured_value,
            state=primitive.state_machine.state,
            retry_count=primitive.state_machine.retry_count,
            confidence=primitive.state_machine.confidence,
            metadata=primitive.state_machine.metadata
        )
    
    async def StreamEvents(
        self,
        request: voice_core_pb2.StreamEventsRequest,
        context: aio.ServicerContext
    ) -> AsyncIterator[voice_core_pb2.Event]:
        """
        Stream events from primitive execution (server-side streaming).
        
        Args:
            request: StreamEventsRequest with conversation_id and optional filters
            context: gRPC context
            
        Yields:
            Event messages as they occur
        """
        conversation_id = request.conversation_id
        trace_id = request.trace_id
        
        logger.info(f"[{trace_id}] Starting event stream for conversation={conversation_id}")
        
        # Initialize event queue if needed
        if conversation_id not in self.event_streams:
            self.event_streams[conversation_id] = []
        
        event_types_filter = set(request.event_types) if request.event_types else None
        
        try:
            # Stream events from queue
            while True:
                # Check if context is cancelled
                if await context.is_cancelled():
                    logger.info(f"[{trace_id}] Event stream cancelled")
                    break
                
                # Get events from queue
                if conversation_id in self.event_streams:
                    events = self.event_streams[conversation_id]
                    
                    while events:
                        event = events.pop(0)
                        
                        # Apply filter if specified
                        if event_types_filter and event.event_type not in event_types_filter:
                            continue
                        
                        # Convert to proto Event
                        proto_event = voice_core_pb2.Event(
                            event_type=event.event_type,
                            timestamp=event.timestamp,
                            conversation_id=event.conversation_id or conversation_id,
                            trace_id=trace_id,
                            data=json.dumps(event.data or {}),
                            metadata=event.metadata or {}
                        )
                        
                        yield proto_event
                
                # Sleep briefly to avoid busy-waiting
                await asyncio.sleep(0.1)
                
        except Exception as e:
            logger.exception(f"[{trace_id}] Error in event stream: {e}")
        finally:
            logger.info(f"[{trace_id}] Event stream ended for conversation={conversation_id}")
    
    async def HealthCheck(
        self,
        request: voice_core_pb2.HealthCheckRequest,
        context: aio.ServicerContext
    ) -> voice_core_pb2.HealthCheckResponse:
        """
        Health check endpoint.
        
        Args:
            request: HealthCheckRequest
            context: gRPC context
            
        Returns:
            HealthCheckResponse with status
        """
        return voice_core_pb2.HealthCheckResponse(
            status=voice_core_pb2.HealthCheckResponse.SERVING,
            message="Voice Core service is healthy"
        )


async def serve(port: int = 50051, host: str = "[::]") -> None:
    """
    Start gRPC server.
    
    Args:
        port: Port to listen on (default: 50051)
        host: Host to bind to (default: "[::]" for IPv6)
    """
    server = aio.server()
    
    # Add servicer
    # If using generated stubs, this will work automatically
    # If using fallback, we'll manually register the servicer methods
    try:
        voice_core_pb2_grpc.add_VoiceCoreServiceServicer_to_server(
            VoiceCoreServiceServicer(),
            server
        )
    except AttributeError:
        # Fallback: manually register servicer methods
        servicer = VoiceCoreServiceServicer()
        # In production with generated stubs, this is handled automatically
        # For now, we'll just log a warning
        logger.warning("Using fallback proto definitions. Some features may be limited.")
        # The server will still work, but RPC methods need to be registered manually
        # For testing, we'll rely on the integration test mock approach
    
    # Listen on port
    listen_addr = f"{host}:{port}"
    server.add_insecure_port(listen_addr)
    
    logger.info(f"Starting Voice Core gRPC server on {listen_addr}")
    
    await server.start()
    
    try:
        await server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Shutting down gRPC server...")
        await server.stop(5)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(serve())
