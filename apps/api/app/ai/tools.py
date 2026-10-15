from datetime import datetime, timezone

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_utc_time",
            "description": (
                "Get the current date and time in UTC."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": False,
            },
        },
    }
]


def execute_tool(
    name: str,
    arguments: dict,
) -> dict:
    if name == "get_current_utc_time":
        if arguments:
            raise ValueError("Unexpected tool arguments")
        return {
            "current_utc_time": datetime.now(
                timezone.utc
            ).isoformat()
        }
    raise ValueError(f"Unknown tool: {name}")
