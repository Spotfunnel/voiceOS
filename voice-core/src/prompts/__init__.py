"""Layer 1 foundation prompt (universal voice AI behavior)."""

from .layer1_foundation import get_layer1_prompt
from .knowledge_combiner import combine_prompts

# Deprecated - for backwards compatibility only
from .layer1_receptionist_core import LAYER_1_CORE_PROMPT

__all__ = ["get_layer1_prompt", "combine_prompts", "LAYER_1_CORE_PROMPT"]
