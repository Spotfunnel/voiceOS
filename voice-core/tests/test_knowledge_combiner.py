"""
Unit tests for the knowledge combiner module.
"""

import sys
from pathlib import Path

import pytest
import tiktoken

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Stub tiktoken encoding to avoid network calls while running tests.
class _DummyEncoding:
    def encode(self, text: str):
        return text.split()

tiktoken.encoding_for_model = lambda model: _DummyEncoding()

from src.prompts.knowledge_combiner import (
    KnowledgeTooLargeError,
    MAX_STATIC_KNOWLEDGE_TOKENS,
    combine_prompts,
    validate_static_knowledge,
)


def test_validate_static_knowledge_small():
    """Valid knowledge should return a small token count."""
    knowledge = "Hours: 9am-5pm Monday to Friday. Services: Plumbing, electrical."

    token_count = validate_static_knowledge(knowledge)

    assert token_count > 0
    assert token_count < MAX_STATIC_KNOWLEDGE_TOKENS


def test_validate_static_knowledge_large():
    """Knowledge exceeding the limit should raise KnowledgeTooLargeError."""
    oversized = "word " * (MAX_STATIC_KNOWLEDGE_TOKENS + 100)

    with pytest.raises(KnowledgeTooLargeError) as excinfo:
        validate_static_knowledge(oversized)

    assert str(MAX_STATIC_KNOWLEDGE_TOKENS) in str(excinfo.value)


def test_combine_prompts_all_fields():
    """Combining Layer 1, knowledge, and Layer 2 yields all sections."""
    layer1 = "Layer1 core prompt."
    knowledge = "Services: Plumbing, electrical."
    layer2 = "You are Sarah, the friendly receptionist."

    combined = combine_prompts(layer1, knowledge, layer2)

    assert "Layer1 core prompt." in combined
    assert "COMPANY KNOWLEDGE BASE" in combined
    assert "services: plumbing" in combined.lower()
    assert "BUSINESS-SPECIFIC CONTEXT" in combined
    assert "You are Sarah" in combined


def test_combine_prompts_layer1_only():
    """Without overrides, the prompt should match Layer 1 exactly."""
    layer1 = "Immutable Layer 1 text."

    combined = combine_prompts(layer1, None, None)

    assert combined == layer1.strip()


def test_combine_prompts_no_knowledge():
    """Layer 2 should still be appended without knowledge."""
    layer1 = "Layer1 core."
    layer2 = "Layer2 customization."

    combined = combine_prompts(layer1, "", layer2)

    assert "COMPANY KNOWLEDGE BASE" not in combined
    assert "Layer2 customization." in combined


def test_combine_prompts_no_layer2():
    """Knowledge should still be inserted when Layer 2 is empty."""
    layer1 = "Layer1 core."
    knowledge = "Policies: 24-hour notice."

    combined = combine_prompts(layer1, knowledge, None)

    assert "COMPANY KNOWLEDGE BASE" in combined
    assert "Policies: 24-hour notice." in combined


def test_combine_prompts_order():
    """Layer 1 should appear before knowledge and Layer 2."""
    layer1 = "Layer1 core."
    knowledge = "Facts: test."
    layer2 = "Layer2 personalization."

    combined = combine_prompts(layer1, knowledge, layer2)

    idx_layer1 = combined.index("Layer1 core.")
    idx_knowledge = combined.index("COMPANY KNOWLEDGE BASE")
    idx_layer2 = combined.index("BUSINESS-SPECIFIC CONTEXT")

    assert idx_layer1 < idx_knowledge < idx_layer2


def test_combine_prompts_knowledge_header():
    """Knowledge section must include the Tier 1 header."""
    combined = combine_prompts("Layer1", "Info", "Layer2")

    assert "Tier 1: Pre-Loaded Static" in combined


def test_knowledge_too_large_error_message():
    """Error messaging should mention the token limit."""
    oversized = "token " * (MAX_STATIC_KNOWLEDGE_TOKENS + 50)

    with pytest.raises(KnowledgeTooLargeError) as excinfo:
        validate_static_knowledge(oversized)

    assert "Reduce knowledge size" in str(excinfo.value)
