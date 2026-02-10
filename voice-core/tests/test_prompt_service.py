from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import pytest

from src.prompts.layer1_foundation import get_layer1_prompt
from src.services.prompt_service import PromptService


class FakeCursor:
    def __init__(self, store: Dict[str, List[Dict[str, Any]]], metrics: Dict[str, int]):
        self.store = store
        self.metrics = metrics
        self._fetchone: Optional[Dict[str, Any]] = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query: str, params: Tuple[Any, ...] = ()):
        q = " ".join(query.strip().lower().split())
        if q.startswith("select") and "from prompts" in q and "layer_2_content" in q:
            self.metrics["select_active"] += 1
            tenant_id = params[0]
            prompts = self.store.get(tenant_id, [])
            active = [p for p in prompts if p.get("is_active")]
            if not active:
                self._fetchone = None
            else:
                active_sorted = sorted(active, key=lambda p: p["version"], reverse=True)
                self._fetchone = {"layer_2_content": active_sorted[0]["layer_2_content"]}
        elif "coalesce(max(version)" in q:
            self.metrics["select_next_version"] += 1
            tenant_id = params[0]
            prompts = self.store.get(tenant_id, [])
            max_version = max([p["version"] for p in prompts], default=0)
            self._fetchone = {"next_version": max_version + 1}
        elif q.startswith("update prompts set is_active = false"):
            tenant_id = params[0]
            for prompt in self.store.get(tenant_id, []):
                prompt["is_active"] = False
        elif q.startswith("insert into prompts"):
            tenant_id, version, content, created_by, metadata = params
            self.store.setdefault(tenant_id, []).append(
                {
                    "version": version,
                    "layer_2_content": content,
                    "is_active": True,
                    "created_by": created_by,
                    "metadata": metadata,
                }
            )
        elif q.startswith("update prompts") and "is_active = true" in q and "version" in q:
            tenant_id, version = params
            for prompt in self.store.get(tenant_id, []):
                prompt["is_active"] = prompt["version"] == version
        else:
            raise AssertionError(f"Unexpected query: {query}")

    def fetchone(self):
        return self._fetchone


class FakeConnection:
    def __init__(self, store: Dict[str, List[Dict[str, Any]]], metrics: Dict[str, int]):
        self.store = store
        self.metrics = metrics

    def cursor(self, cursor_factory=None):
        return FakeCursor(self.store, self.metrics)

    def commit(self):
        return None

    def rollback(self):
        return None


class FakeDbService:
    def __init__(self, store: Dict[str, List[Dict[str, Any]]], metrics: Dict[str, int]):
        self.store = store
        self.metrics = metrics
        self.connection = FakeConnection(self.store, self.metrics)

    def get_connection(self):
        return self.connection

    def put_connection(self, conn):
        return None


def _build_service(
    store: Optional[Dict[str, List[Dict[str, Any]]]] = None,
    metrics: Optional[Dict[str, int]] = None,
) -> PromptService:
    metrics = metrics or {"select_active": 0, "select_next_version": 0}
    store = store or {}
    return PromptService(db_service=FakeDbService(store, metrics)), store, metrics


def test_get_system_prompt_combines_layers():
    tenant_id = "tenant-1"
    service, store, _ = _build_service(
        store={
            tenant_id: [
                {"version": 1, "layer_2_content": "Layer 2 content", "is_active": True}
            ]
        }
    )

    combined = service.get_system_prompt(tenant_id)

    assert get_layer1_prompt() in combined
    assert "Layer 2 content" in combined


def test_caching_avoids_db_hit():
    tenant_id = "tenant-2"
    service, store, metrics = _build_service(
        store={
            tenant_id: [
                {"version": 1, "layer_2_content": "Cached Layer 2", "is_active": True}
            ]
        }
    )

    service.get_system_prompt(tenant_id)
    service.get_system_prompt(tenant_id)

    assert metrics["select_active"] == 1


def test_cache_invalidation_on_update_layer_2():
    tenant_id = "tenant-3"
    service, store, metrics = _build_service(
        store={
            tenant_id: [
                {"version": 1, "layer_2_content": "Old prompt", "is_active": True}
            ]
        }
    )

    assert "Old prompt" in service.get_system_prompt(tenant_id)
    service.update_layer_2(tenant_id, "New prompt")
    assert "New prompt" in service.get_system_prompt(tenant_id)
    assert metrics["select_active"] == 2


def test_rollback_version():
    tenant_id = "tenant-4"
    service, store, _ = _build_service(
        store={
            tenant_id: [
                {"version": 1, "layer_2_content": "Version 1", "is_active": True}
            ]
        }
    )

    service.update_layer_2(tenant_id, "Version 2")
    service.rollback_version(tenant_id, 1)

    assert "Version 1" in service.get_system_prompt(tenant_id)
    assert "Version 2" not in service.get_system_prompt(tenant_id)


def test_fallback_when_no_active_prompt():
    tenant_id = "tenant-5"
    service, store, _ = _build_service()

    combined = service.get_system_prompt(tenant_id)

    assert combined == get_layer1_prompt()
