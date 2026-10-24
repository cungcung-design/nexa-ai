"""Safe display names for uploaded documents.

The stored object name is always a generated id. This helper only cleans
the name that is shown to people in the workspace.
"""

from __future__ import annotations


def safe_upload_filename(raw: str | None) -> str:
    name = (raw or "document").replace("\\", "/").split("/")[-1]
    cleaned = []
    for character in name:
        if character.isprintable() and character not in {'"', "'", ";", "\r", "\n"}:
            cleaned.append(character)
    name = "".join(cleaned).strip().strip(".")
    if not name or name in {".", ".."}:
        return "document"
    return name[:255]
