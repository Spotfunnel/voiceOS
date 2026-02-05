"""
Integration tests for tenant configuration knowledge handling.
"""

import sys
from pathlib import Path

import pytest

# Ensure tests load modules from voice-core directory
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.api.tenant_config import (
    CreateTenantRequest,
    TenantConfig,
    _to_tenant_config,
    create_tenant,
)


def test_tenant_config_model_supports_static_knowledge():
    """TenantConfig should expose the static_knowledge field."""
    config = TenantConfig(
        tenant_id="t1",
        business_name="Test Plumbing",
        phone_number="0400 000 000",
        system_prompt="",
        agent_role="receptionist",
        agent_personality="friendly",
        greeting_message="Hello",
        objective_graph={},
        static_knowledge="Hours: 9am-5pm",
    )

    assert config.static_knowledge == "Hours: 9am-5pm"


def test_to_tenant_config_includes_static_knowledge():
    """_to_tenant_config should propagate static knowledge from the tenant row."""
    tenant_row = {
        "tenant_id": "t1",
        "business_name": "Test Plumbing",
        "phone_number": "0400 000 000",
        "locale": "en-AU",
        "system_prompt": "prompt",
        "agent_role": "receptionist",
        "agent_personality": "friendly",
        "greeting_message": "Hello",
        "static_knowledge": "FAQ content",
        "created_at": "2026-01-01T00:00:00Z",
    }

    config_row = {"objective_graph": "{}"}

    tenant_config = _to_tenant_config(tenant_row, config_row, {})

    assert tenant_config.static_knowledge == "FAQ content"


@pytest.mark.asyncio
async def test_create_tenant_inserts_static_knowledge(monkeypatch):
    """Creating a tenant should insert the template's static knowledge."""
    template = {
        "system_prompt": "prompt",
        "agent_role": "receptionist",
        "agent_personality": "friendly",
        "greeting_message": "Hello",
        "static_knowledge": "FAQ content",
        "objective_graph": {"nodes": []},
        "service_catalog": [],
        "faq_knowledge_base": [],
    }

    executed = []

    class DummyConn:
        def execute(self, sql, params=None):
            executed.append(params)
            return self

        def commit(self):
            pass

        def rollback(self):
            pass

        def close(self):
            pass

    dummy_conn = DummyConn()

    monkeypatch.setattr("src.api.tenant_config.load_template", lambda _: template)
    monkeypatch.setattr("src.api.tenant_config.get_db_connection", lambda: dummy_conn)

    request = CreateTenantRequest(
        business_name="Test Plumbing",
        phone_number="0400 000 000",
        template_id="full_receptionist",
    )

    await create_tenant(request)

    assert any(
        params and params[-1] == "FAQ content" for params in executed if params
    )
