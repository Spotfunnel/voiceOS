"""
Knowledge combiner for building complete system prompts.

Combines:
1. Layer 1 foundation prompt (immutable voice AI behavior) - from layer1_foundation.py
2. Static knowledge (Tier 1, customer-specific) - from knowledge base
3. Layer 2 system prompt (agent role/personality/objectives) - from onboarding "Persona & Purpose"
"""

from typing import Optional

import tiktoken

from .layer1_foundation import get_layer1_prompt

MAX_STATIC_KNOWLEDGE_TOKENS = 10_000


class KnowledgeTooLargeError(ValueError):
    """Raised when static knowledge exceeds 10K token limit."""


def validate_static_knowledge(knowledge: str) -> int:
    """
    Validate static knowledge size before storing it.

    Args:
        knowledge: Tier 1 knowledge text.

    Returns:
        Token count for `knowledge`.

    Raises:
        KnowledgeTooLargeError: If knowledge exceeds the 10K token limit.
    """
    if not knowledge:
        return 0

    encoding = tiktoken.encoding_for_model("gpt-4")
    token_count = len(encoding.encode(knowledge))

    if token_count > MAX_STATIC_KNOWLEDGE_TOKENS:
        raise KnowledgeTooLargeError(
            "Static knowledge is "
            f"{token_count} tokens, max is {MAX_STATIC_KNOWLEDGE_TOKENS}. "
            "Reduce knowledge size or upgrade to Tier 3 (vector database) post-V1."
        )

    return token_count


def combine_prompts(
    static_knowledge: Optional[str] = None,
    layer2_system_prompt: Optional[str] = None,
) -> str:
    """
    Combine Layer 1 + static knowledge + Layer 2 into a single system prompt.

    Layer 1 is automatically loaded from layer1_foundation.py (universal for all agents).

    Args:
        static_knowledge: Tier 1 knowledge provided by the customer (knowledge base).
        layer2_system_prompt: Layer 2 system prompt (Persona & Purpose from onboarding).

    Returns:
        Combined prompt string ready for LLM calls.
    """
    # Layer 1: Universal foundation (always included)
    sections = [get_layer1_prompt()]

    knowledge_text = (static_knowledge or "").strip()
    if knowledge_text:
        validate_static_knowledge(knowledge_text)
        knowledge_section = "\n".join(
            [
                "---",
                "COMPANY KNOWLEDGE BASE (Tier 1: Pre-Loaded Static)",
                "---",
                "",
                knowledge_text,
                "",
                "IMPORTANT: Use this knowledge to answer customer questions. Keep responses under 20 seconds (150 tokens max).",
                "If you don't have specific information, say: \"I don't have that information on hand. Let me connect you with someone who can help.\"",
            ]
        )
        sections.append(knowledge_section)

    layer2_text = (layer2_system_prompt or "").strip()
    if layer2_text:
        layer2_section = "\n".join(
            [
                "---",
                "YOUR ROLE & PURPOSE (Layer 2: Business-Specific)",
                "---",
                "",
                layer2_text,
                "",
                "This defines WHO you are, WHAT you do, and what SUCCESS looks like for this specific business.",
            ]
        )
        sections.append(layer2_section)

    return "\n\n".join(sections)
