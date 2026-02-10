"""
LLM tools processor.

Injects LLM tool definitions into the pipeline so function calling is enabled.
"""

from typing import List

from pipecat.frames.frames import Frame, LLMSetToolsFrame, LLMSetToolChoiceFrame
from pipecat.processors.frame_processor import FrameProcessor


class LLMToolsProcessor(FrameProcessor):
    """
    Push LLM tool configuration frames once at the start of the pipeline.
    """

    def __init__(self, tools: List[dict], tool_choice: str = "auto"):
        super().__init__()
        self.tools = tools
        self.tool_choice = tool_choice
        self._sent = False

    async def process_frame(self, frame: Frame, direction):
        if not self._sent:
            await self.push_frame(LLMSetToolsFrame(tools=self.tools), direction)
            await self.push_frame(LLMSetToolChoiceFrame(tool_choice=self.tool_choice), direction)
            self._sent = True

        await self.push_frame(frame, direction)
