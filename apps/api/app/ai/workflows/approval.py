from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt


class ApprovalState(TypedDict, total=False):
    organization_id: str
    agent_id: str
    action: str
    arguments: dict[str, Any]
    approved: bool
    result: dict[str, Any]


def approval_node(state: ApprovalState):
    decision = interrupt(
        {
            "type": "tool_approval",
            "action": state["action"],
            "arguments": state["arguments"],
            "message": "This action requires human approval.",
        }
    )
    if decision is True:
        return {"approved": True}
    return {"approved": False}


def execute_node(state: ApprovalState):
    action = state["action"]
    arguments = state["arguments"]
    if action == "demo_create_note":
        return {
            "result": {"note": f"Demo note created: {arguments.get('note', '')}"}
        }
    return {"result": {"error": f"Unknown action: {action}"}}


def route_after_approval(state: ApprovalState):
    if state.get("approved"):
        return "execute"
    return "reject"


def reject_node(state: ApprovalState):
    return {"result": {"error": "Action rejected by human"}}


def build_approval_graph(checkpointer):
    """Compile the approval graph against a caller-supplied checkpointer.

    Production passes the PostgreSQL checkpointer. Tests can pass a second,
    independent PostgreSQL checkpointer to prove the pause survives the
    first graph instance.
    """
    if checkpointer is None:
        raise RuntimeError(
            "Workflow checkpoints require PostgreSQL. "
            "In-memory checkpoint storage is not available."
        )
    return (
        StateGraph(ApprovalState)
        .add_node("approval", approval_node)
        .add_node("execute", execute_node)
        .add_node("reject", reject_node)
        .add_edge(START, "approval")
        .add_conditional_edges(
            "approval",
            route_after_approval,
            {"execute": "execute", "reject": "reject"},
        )
        .add_edge("execute", END)
        .add_edge("reject", END)
        .compile(checkpointer=checkpointer)
    )


def awaiting_human_approval(snapshot) -> bool:
    """True when the saved run is paused inside the human interrupt."""
    tasks = getattr(snapshot, "tasks", None) or ()
    return any(getattr(task, "interrupts", None) for task in tasks)


def checkpoint_organization_id(snapshot) -> str | None:
    values = getattr(snapshot, "values", None) or {}
    organization_id = values.get("organization_id")
    if not organization_id:
        return None
    return str(organization_id)
