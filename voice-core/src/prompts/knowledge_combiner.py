"""
Knowledge combiner for building complete system prompts.

Combines:
1. Layer 1 core prompt (immutable receptionist behavior)
2. Static knowledge (Tier 1, customer-specific)
3. Layer 2 system prompt (agent role/personality/objectives)
"""

from typing import Optional

import tiktoken

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
    layer1_core_prompt: str,
    static_knowledge: Optional[str],
    layer2_system_prompt: Optional[str],
) -> str:
    """
    Combine Layer 1 + static knowledge + Layer 2 into a single system prompt.

    Args:
        layer1_core_prompt: Immutable receptionist instruction.
        static_knowledge: Tier 1 knowledge provided by the customer.
        layer2_system_prompt: Layer 2 system prompt override or customization.

    Returns:
        Combined prompt string ready for LLM calls.
    """
    sections = [layer1_core_prompt.strip()]

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
                "BUSINESS-SPECIFIC CONTEXT (Layer 2)",
                "---",
                "",
                layer2_text,
            ]
        )
        sections.append(layer2_section)

    return "\n\n".join(sections)
