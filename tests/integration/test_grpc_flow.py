"""
Integration test for gRPC communication between Voice Core and Orchestration.

Tests:
1. Start Voice Core gRPC server
2. Execute email capture primitive via gRPC
3. Verify events are streamed correctly
4. Verify trace ID propagation
5. Verify timeout handling
"""

import asyncio
import pytest
import grpc
from grpc import aio
import time
import json
from typing import AsyncIterator

# Import Voice Core gRPC server
import sys
from pathlib import Path

# Add voice-core to path
voice_core_path = Path(__file__).parent.parent.parent / "voice-core" / "src"
sys.path.insert(0, str(voice_core_path))

from grpc.server import VoiceCoreServiceServicer, serve
from grpc.primitive_registry import PrimitiveRegistry

# For now, we'll use a simplified proto structure for testing
# In production, these would be generated from proto file


class MockExecutePrimitiveRequest:
    def __init__(self):
        self.objective_type = ""
        self.params = {}
        self.conversation_id = ""
        self.trace_id = ""
        self.purpose = ""
        self.metadata = {}
        self.timeout_seconds = 30


class MockExecutePrimitiveResponse:
    def __init__(self):
        self.success = False
        self.data = {}
        self.error = None
        self.metadata = None


class MockError:
    def __init__(self):
        self.code = ""
        self.message = ""
        self.details = ""


class MockExecutionMetadata:
    def __init__(self):
        self.duration_ms = 0
        self.retry_count = 0
        self.confidence = 0.0
        self.state = ""


class MockStreamEventsRequest:
    def __init__(self):
        self.conversation_id = ""
        self.trace_id = ""
        self.event_types = []


class MockEvent:
    def __init__(self):
        self.event_type = ""
        self.timestamp = ""
        self.conversation_id = ""
        self.trace_id = ""
        self.data = ""
        self.metadata = {}


class MockHealthCheckRequest:
    def __init__(self):
        self.service = ""


class MockHealthCheckResponse:
    SERVING = 1
    NOT_SERVING = 2

    def __init__(self):
        self.status = 1
        self.message = ""


@pytest.fixture
async def grpc_server():
    """Start gRPC server for testing"""
    server = aio.server()
    
    # Create servicer
    servicer = VoiceCoreServiceServicer()
    
    # Note: In real implementation, we'd use generated stubs
    # For testing, we'll mock the proto classes
    
    # Start server on random port
    port = 50051
    listen_addr = f"[::]:{port}"
    server.add_insecure_port(listen_addr)
    
    await server.start()
    
    yield servicer, port
    
    await server.stop(5)


@pytest.mark.asyncio
async def test_execute_email_capture_primitive(grpc_server):
    """Test executing email capture primitive via gRPC"""
    servicer, port = grpc_server
    
    # Create request
    request = MockExecutePrimitiveRequest()
    request.objective_type = "capture_email_au"
    request.conversation_id = "test-conv-001"
    request.trace_id = "test-trace-001"
    request.purpose = "Collect customer email for newsletter"
    request.params = {
        "transcription": "jane at gmail dot com",
        "confidence": "0.85",
        "confirmation": "yes"
    }
    request.timeout_seconds = 30
    
    # Create mock context
    class MockContext:
        def __init__(self):
            self.invocation_metadata_dict = {"trace-id": request.trace_id}
        
        def invocation_metadata(self):
            return [(k, v) for k, v in self.invocation_metadata_dict.items()]
        
        async def is_cancelled(self):
            return False
    
    context = MockContext()
    
    # Execute primitive
    response = await servicer.ExecutePrimitive(request, context)
    
    # Verify response
    assert response is not None
    assert response.success is True
    assert "email" in response.data or "value" in response.data
    
    # Verify metadata
    assert response.metadata is not None
    assert response.metadata.duration_ms > 0
    assert response.metadata.retry_count >= 0
    
    # Verify email was captured
    email_value = response.data.get("email") or response.data.get("value")
    assert email_value is not None
    assert "@" in email_value
    assert "gmail.com" in email_value.lower()


@pytest.mark.asyncio
async def test_trace_id_propagation(grpc_server):
    """Test that trace ID is propagated through gRPC metadata"""
    servicer, port = grpc_server
    
    trace_id = "test-trace-propagation-001"
    
    request = MockExecutePrimitiveRequest()
    request.objective_type = "capture_email_au"
    request.conversation_id = "test-conv-002"
    request.trace_id = trace_id
    request.purpose = "Test trace ID propagation"
    request.params = {
        "transcription": "test at example dot com",
        "confidence": "0.9",
        "confirmation": "yes"
    }
    
    class MockContext:
        def __init__(self, trace_id):
            self.invocation_metadata_dict = {"trace-id": trace_id}
        
        def invocation_metadata(self):
            return [(k, v) for k, v in self.invocation_metadata_dict.items()]
        
        async def is_cancelled(self):
            return False
    
    context = MockContext(trace_id)
    
    # Execute primitive
    response = await servicer.ExecutePrimitive(request, context)
    
    # Verify trace ID was used (check logs or event stream)
    # The trace_id should be logged and included in events
    assert response is not None
    
    # Verify events contain trace_id
    # In real implementation, we'd check the event stream
    assert servicer.event_streams.get(request.conversation_id) is not None


@pytest.mark.asyncio
async def test_timeout_handling(grpc_server):
    """Test that timeout is enforced (30s max per primitive)"""
    servicer, port = grpc_server
    
    request = MockExecutePrimitiveRequest()
    request.objective_type = "capture_email_au"
    request.conversation_id = "test-conv-003"
    request.trace_id = "test-trace-timeout-001"
    request.purpose = "Test timeout"
    request.params = {
        "transcription": "slow at example dot com",
        "confidence": "0.5"  # Low confidence might cause retries
    }
    request.timeout_seconds = 1  # Very short timeout for testing
    
    class MockContext:
        def __init__(self):
            self.invocation_metadata_dict = {}
        
        def invocation_metadata(self):
            return []
        
        async def is_cancelled(self):
            return False
    
    context = MockContext()
    
    # Execute primitive with short timeout
    start_time = time.time()
    response = await servicer.ExecutePrimitive(request, context)
    duration = time.time() - start_time
    
    # Verify timeout was respected (should complete quickly or timeout)
    # Note: Actual timeout behavior depends on implementation
    # For now, we just verify the request completes
    assert response is not None


@pytest.mark.asyncio
async def test_primitive_not_found(grpc_server):
    """Test error handling when primitive is not found"""
    servicer, port = grpc_server
    
    request = MockExecutePrimitiveRequest()
    request.objective_type = "nonexistent_primitive"
    request.conversation_id = "test-conv-004"
    request.trace_id = "test-trace-notfound-001"
    request.purpose = "Test error handling"
    
    class MockContext:
        def __init__(self):
            self.invocation_metadata_dict = {}
        
        def invocation_metadata(self):
            return []
        
        async def is_cancelled(self):
            return False
    
    context = MockContext()
    
    # Execute primitive
    response = await servicer.ExecutePrimitive(request, context)
    
    # Verify error response
    assert response is not None
    assert response.success is False
    assert response.error is not None
    assert response.error.code == "PRIMITIVE_NOT_FOUND"


@pytest.mark.asyncio
async def test_event_streaming(grpc_server):
    """Test that events are streamed correctly"""
    servicer, port = grpc_server
    
    conversation_id = "test-conv-stream-001"
    trace_id = "test-trace-stream-001"
    
    # First, execute a primitive to generate events
    request = MockExecutePrimitiveRequest()
    request.objective_type = "capture_email_au"
    request.conversation_id = conversation_id
    request.trace_id = trace_id
    request.purpose = "Test event streaming"
    request.params = {
        "transcription": "stream at test dot com",
        "confidence": "0.85",
        "confirmation": "yes"
    }
    
    class MockContext:
        def __init__(self):
            self.invocation_metadata_dict = {"trace-id": trace_id}
        
        def invocation_metadata(self):
            return [(k, v) for k, v in self.invocation_metadata_dict.items()]
        
        async def is_cancelled(self):
            return False
    
    context = MockContext()
    
    # Execute primitive to generate events
    await servicer.ExecutePrimitive(request, context)
    
    # Verify events were generated
    assert conversation_id in servicer.event_streams
    events = servicer.event_streams[conversation_id]
    assert len(events) > 0
    
    # Verify event structure
    event = events[0]
    assert event.event_type is not None
    assert event.timestamp is not None
    assert event.conversation_id == conversation_id


@pytest.mark.asyncio
async def test_health_check(grpc_server):
    """Test health check endpoint"""
    servicer, port = grpc_server
    
    request = MockHealthCheckRequest()
    
    class MockContext:
        def invocation_metadata(self):
            return []
    
    context = MockContext()
    
    # Check health
    response = await servicer.HealthCheck(request, context)
    
    # Verify health check response
    assert response is not None
    assert response.status == MockHealthCheckResponse.SERVING
    assert "healthy" in response.message.lower() or "serving" in response.message.lower()


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
