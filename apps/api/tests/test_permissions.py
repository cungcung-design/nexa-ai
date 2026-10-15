import pytest

from app.core.permissions import (
    Role,
    Permission,
    has_permission,
)


@pytest.mark.parametrize(
    "role,permission,expected",
    [
        (Role.OWNER, Permission.BILLING_MANAGE, True),
        (Role.ADMIN, Permission.BILLING_MANAGE, False),
        (Role.ADMIN, Permission.AGENT_PUBLISH, True),
        (Role.DEVELOPER, Permission.AGENT_WRITE, True),
        (Role.DEVELOPER, Permission.AGENT_PUBLISH, False),
        (Role.VIEWER, Permission.AGENT_READ, True),
        (Role.VIEWER, Permission.EVALUATION_RUN, False),
        ("INVALID", Permission.AGENT_READ, False),
    ],
)
def test_permissions(role, permission, expected):
    assert has_permission(role, permission) is expected