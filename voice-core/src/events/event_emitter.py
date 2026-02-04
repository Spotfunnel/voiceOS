"""
Event emission system using Observer pattern

Emits events for observability without affecting conversation behavior.
Events logged to stdout for now (Postgres integration in Layer 2/3).
"""

import asyncio
import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, asdict
from collections import deque

logger = logging.getLogger(__name__)


@dataclass
class VoiceCoreEvent:
    """Immutable event schema for Voice Core"""
    event_type: str
    timestamp: str
    conversation_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


class EventEmitter:
    """
    Event emitter for Voice Core observability.
    
    Uses Observer pattern - emits events without blocking conversation.
    Events are fire-and-forget (async, non-blocking).
    
    Architecture compliance:
    - R-ARCH-009: Voice Core MUST emit events for observability
    - Events MUST NOT affect conversation behavior
    """
    
    def __init__(self, conversation_id: Optional[str] = None):
        """
        Initialize event emitter.
        
        Args:
            conversation_id: Optional conversation ID for event correlation
        """
        self.conversation_id = conversation_id
        self.observers: List[Callable[[VoiceCoreEvent], None]] = []
        self._log_to_stdout = os.getenv("VOICE_CORE_EVENT_STDOUT", "0") == "1"
        self._event_log_max = int(os.getenv("VOICE_CORE_EVENT_LOG_MAX", "1000"))
        self.event_log = deque(maxlen=max(self._event_log_max, 0))
        
    def add_observer(self, observer: Callable[[VoiceCoreEvent], None]):
        """Add observer callback for events"""
        self.observers.append(observer)
    
    def remove_observer(self, observer: Callable[[VoiceCoreEvent], None]):
        """Remove observer callback for events"""
        try:
            self.observers.remove(observer)
        except ValueError:
            pass
    
    def on(self, event_type: str, observer: Callable[[VoiceCoreEvent], None]):
        """Compatibility wrapper for event subscriptions."""
        self.add_observer(observer)
    
    def off(self, event_type: str, observer: Callable[[VoiceCoreEvent], None]):
        """Compatibility wrapper for event unsubscriptions."""
        self.remove_observer(observer)
    
    async def emit(
        self,
        event_type: str,
        data: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Emit event asynchronously (non-blocking).
        
        Args:
            event_type: Event type (e.g., 'call_started', 'user_spoke', 'agent_spoke')
            data: Event data payload
            metadata: Optional metadata (source, version, etc.)
        """
        event = VoiceCoreEvent(
            event_type=event_type,
            timestamp=datetime.now(timezone.utc).isoformat(),
            conversation_id=self.conversation_id,
            data=data or {},
            metadata=metadata or {}
        )
        
        # Log to stdout (for now)
        self._log_event(event)
        
        # Store in memory (for testing/replay) with a bounded log
        if self._event_log_max > 0:
            self.event_log.append(event)
        
        # Notify observers (non-blocking)
        for observer in self.observers:
            try:
                if asyncio.iscoroutinefunction(observer):
                    asyncio.create_task(observer(event))
                else:
                    observer(event)
            except Exception as e:
                # Observer failures must not crash conversation
                logger.error(f"Observer failed for event {event_type}: {e}")
    
    def _log_event(self, event: VoiceCoreEvent):
        """Log event to stdout (structured JSON)"""
        event_dict = asdict(event)
        logger.info(f"VOICE_CORE_EVENT: {json.dumps(event_dict)}")
        if self._log_to_stdout:
            print(f"[EVENT] {event.event_type}: {json.dumps(event_dict)}")
    
    def get_events(self, event_type: Optional[str] = None) -> List[VoiceCoreEvent]:
        """
        Get events from log (for testing/debugging).
        
        Args:
            event_type: Optional filter by event type
            
        Returns:
            List of events matching filter
        """
        events = list(self.event_log)
        if event_type:
            return [e for e in events if e.event_type == event_type]
        return events
    
    def clear_events(self):
        """Clear event log (for testing)"""
        self.event_log.clear()
