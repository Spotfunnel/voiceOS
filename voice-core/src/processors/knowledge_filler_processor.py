"""
Knowledge query filler processor.

When the LLM triggers a knowledge base tool call, emit a short filler
sentence to reduce perceived latency (e.g., "Let me look that up for you").
"""

from typing import Set, Optional, List

from pipecat.frames.frames import Frame, FunctionCallsStartedFrame, TTSSpeakFrame
from pipecat.processors.frame_processor import FrameProcessor
from ..tools.knowledge_tool import get_kb_filler_text


class KnowledgeFillerProcessor(FrameProcessor):
    """
    Emits a filler phrase when query_knowledge tool is called.
    """

    def __init__(
        self,
        tenant_id: Optional[str] = None,
        default_filler_text: str = "Let me look that up for you.",
    ):
        super().__init__()
        self.tenant_id = tenant_id
        self.default_filler_text = default_filler_text
        self._handled_calls: Set[str] = set()

    async def process_frame(self, frame: Frame, direction):
        if isinstance(frame, FunctionCallsStartedFrame):
            for call in frame.function_calls:
                if call.function_name == "query_knowledge" and call.tool_call_id not in self._handled_calls:
                    self._handled_calls.add(call.tool_call_id)
                    kb_names: Optional[List[str]] = None
                    if isinstance(call.arguments, dict):
                        kb_names = call.arguments.get("kb_names")
                    filler_text = None
                    if self.tenant_id:
                        filler_text = get_kb_filler_text(self.tenant_id, kb_names)
                    await self.push_frame(
                        TTSSpeakFrame(text=filler_text or self.default_filler_text),
                        direction,
                    )

        await self.push_frame(frame, direction)
