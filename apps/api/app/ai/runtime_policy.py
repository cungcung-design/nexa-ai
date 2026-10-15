from dataclasses import dataclass


@dataclass(frozen=True)
class AgentRuntimePolicy:
    public_access: bool
    allow_tools: bool
    allow_private_knowledge: bool
    max_tool_rounds: int


INTERNAL_POLICY = AgentRuntimePolicy(
    public_access=False,
    allow_tools=True,
    allow_private_knowledge=True,
    max_tool_rounds=3,
)

PUBLIC_WIDGET_POLICY = AgentRuntimePolicy(
    public_access=True,
    allow_tools=False,
    allow_private_knowledge=False,
    max_tool_rounds=0,
)