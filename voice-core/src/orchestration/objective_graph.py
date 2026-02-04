"""
Objective graph execution engine.

Loads declarative objective graphs and orchestrates primitive execution
with conditional branching.
"""

from dataclasses import dataclass
import logging
from typing import Dict, Any, List, Optional

from ..events.event_emitter import EventEmitter, VoiceCoreEvent
from ..grpc.primitive_registry import PrimitiveRegistry
from ..primitives.multi_primitive_processor import MultiPrimitiveProcessor

logger = logging.getLogger(__name__)


@dataclass
class GraphNode:
    """Node in the objective graph."""

    id: str
    type: str  # "sequence", "action", "terminal"
    primitives: Optional[List[str]] = None
    on_success: Optional[str] = None
    on_failure: Optional[str] = None
    action: Optional[str] = None
    message: Optional[str] = None


class ObjectiveGraph:
    """
    Declarative objective graph executor.

    Responsibilities:
    - Parse and validate DAG structure
    - Build MultiPrimitiveProcessor for sequence nodes
    - Track current node and transitions
    - Emit events for observability
    - Rebuild state from event log
    """

    def __init__(
        self,
        graph_config: Dict[str, Any],
        tenant_context: Dict[str, Any],
        event_emitter: Optional[EventEmitter] = None,
    ):
        self.graph_config = graph_config
        self.tenant_context = tenant_context
        self.event_emitter = event_emitter

        self.nodes: Dict[str, GraphNode] = {}
        self.completed_nodes: List[str] = []
        self.failed_nodes: List[str] = []
        self.captured_data: Dict[str, Any] = {}

        self._parse_nodes()
        self._validate_dag()

        self.entry_node_id = graph_config["nodes"][0]["id"]
        self.current_node_id = self.entry_node_id

        logger.info("ObjectiveGraph initialized with %s nodes", len(self.nodes))

    def _parse_nodes(self) -> None:
        node_defs = self.graph_config.get("nodes", [])
        if not node_defs:
            raise ValueError("Objective graph must define at least one node")

        for node_def in node_defs:
            node = GraphNode(
                id=node_def["id"],
                type=node_def["type"],
                primitives=node_def.get("primitives"),
                on_success=node_def.get("on_success"),
                on_failure=node_def.get("on_failure"),
                action=node_def.get("action"),
                message=node_def.get("message"),
            )
            self.nodes[node.id] = node

    def _validate_dag(self) -> None:
        for node in self.nodes.values():
            if node.on_success and node.on_success not in self.nodes:
                raise ValueError(
                    f"Node {node.id} references non-existent node: {node.on_success}"
                )
            if node.on_failure and node.on_failure not in self.nodes:
                raise ValueError(
                    f"Node {node.id} references non-existent node: {node.on_failure}"
                )
            if node.type == "sequence" and not node.primitives:
                raise ValueError(f"Sequence node {node.id} must define primitives")

        # Ensure at least one terminal node exists
        if not any(node.type == "terminal" for node in self.nodes.values()):
            raise ValueError("Objective graph must define at least one terminal node")

        visited = set()
        rec_stack = set()

        def has_cycle(node_id: str) -> bool:
            visited.add(node_id)
            rec_stack.add(node_id)
            node = self.nodes[node_id]
            for next_id in [node.on_success, node.on_failure]:
                if next_id is None:
                    continue
                if next_id not in visited:
                    if has_cycle(next_id):
                        return True
                elif next_id in rec_stack:
                    return True
            rec_stack.remove(node_id)
            return False

        for node_id in self.nodes:
            if node_id not in visited:
                if has_cycle(node_id):
                    raise ValueError(f"Objective graph contains cycle at {node_id}")

        logger.info("Objective graph validation passed")

    def get_current_node(self) -> GraphNode:
        return self.nodes[self.current_node_id]

    def build_processor_for_node(
        self, node_id: str
    ) -> Optional[MultiPrimitiveProcessor]:
        node = self.nodes[node_id]
        if node.type != "sequence":
            return None

        primitive_instances = []
        for primitive_type in node.primitives or []:
            primitive_class = PrimitiveRegistry.get_primitive(primitive_type)
            if primitive_class is None:
                raise ValueError(f"Unknown primitive type: {primitive_type}")

            if primitive_type == "capture_service_au":
                instance = primitive_class(
                    service_catalog=self.tenant_context.get("service_catalog", []),
                    locale=self.tenant_context.get("locale", "en-AU"),
                )
            elif primitive_type == "faq_handler_au":
                instance = primitive_class(
                    faq_knowledge_base=self.tenant_context.get(
                        "faq_knowledge_base", []
                    ),
                    locale=self.tenant_context.get("locale", "en-AU"),
                )
            else:
                instance = primitive_class(
                    locale=self.tenant_context.get("locale", "en-AU")
                )

            primitive_instances.append(instance)

        return MultiPrimitiveProcessor(
            primitive_instances=primitive_instances,
            event_emitter=self.event_emitter,
            trace_id=f"node-{node_id}",
        )

    async def start(self) -> None:
        if self.event_emitter:
            await self.event_emitter.emit(
                "objective_graph_started",
                data={
                    "entry_node": self.entry_node_id,
                    "node_count": len(self.nodes),
                },
            )

    async def transition_on_success(self) -> Optional[str]:
        current_node = self.nodes[self.current_node_id]
        self.completed_nodes.append(current_node.id)
        next_node = current_node.on_success

        if self.event_emitter:
            await self.event_emitter.emit(
                "objective_graph_transition",
                data={
                    "from_node": current_node.id,
                    "to_node": next_node,
                    "result": "success",
                },
            )

        if next_node:
            self.current_node_id = next_node
        return next_node

    async def transition_on_failure(self) -> Optional[str]:
        current_node = self.nodes[self.current_node_id]
        self.failed_nodes.append(current_node.id)
        next_node = current_node.on_failure

        if self.event_emitter:
            await self.event_emitter.emit(
                "objective_graph_transition",
                data={
                    "from_node": current_node.id,
                    "to_node": next_node,
                    "result": "failure",
                },
            )

        if next_node:
            self.current_node_id = next_node
        return next_node

    def apply_event(self, event: VoiceCoreEvent) -> None:
        if event.event_type == "objective_graph_transition":
            to_node = (event.data or {}).get("to_node")
            if to_node:
                self.current_node_id = to_node
        elif event.event_type == "objective_chain_completed":
            captured = (event.data or {}).get("captured_data", {})
            self.captured_data.update(captured)

    def rebuild_from_events(self, events: List[VoiceCoreEvent]) -> None:
        for event in events:
            self.apply_event(event)

    def is_terminal(self) -> bool:
        return self.nodes[self.current_node_id].type == "terminal"
