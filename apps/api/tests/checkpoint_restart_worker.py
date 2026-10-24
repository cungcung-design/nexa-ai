"""Run one checkpoint step in a fresh Python process.

The parent test starts a workflow here, lets this process exit, then resumes
it in a second process. That is the API-restart case: the graph object and
its database pool are gone, and only PostgreSQL still has the thread.
"""

import json
import sys
from uuid import uuid4

from langgraph.types import Command

from app.ai.workflows.approval import build_approval_graph
from app.ai.workflows.checkpointer import open_checkpoint_runtime


def _config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


def start(note: str, destination: str) -> None:
    runtime = open_checkpoint_runtime()
    try:
        graph = build_approval_graph(runtime.saver)
        thread_id = str(uuid4())
        graph.invoke(
            {
                "organization_id": "process-restart",
                "agent_id": "process-restart-agent",
                "action": "demo_create_note",
                "arguments": {"note": note},
            },
            _config(thread_id),
        )
        snapshot = graph.get_state(_config(thread_id))
        waiting = any(
            getattr(task, "interrupts", None) for task in (snapshot.tasks or ())
        )
        payload = {"thread_id": thread_id, "waiting": waiting}
    finally:
        runtime.close()
    with open(destination, "w", encoding="utf-8") as handle:
        json.dump(payload, handle)


def resume(thread_id: str, approved: str, destination: str) -> None:
    runtime = open_checkpoint_runtime()
    try:
        graph = build_approval_graph(runtime.saver)
        result = graph.invoke(
            Command(resume=approved == "true"),
            _config(thread_id),
        )
    finally:
        runtime.close()
    with open(destination, "w", encoding="utf-8") as handle:
        json.dump(result, handle)


if __name__ == "__main__":
    command = sys.argv[1]
    if command == "start":
        start(sys.argv[2], sys.argv[3])
    elif command == "resume":
        resume(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        raise SystemExit(f"unknown command {command}")
