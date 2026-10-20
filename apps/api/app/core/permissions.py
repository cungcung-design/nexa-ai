from enum import StrEnum


class Role(StrEnum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    DEVELOPER = "DEVELOPER"
    VIEWER = "VIEWER"


class Permission(StrEnum):
    AGENT_READ = "agent.read"
    AGENT_WRITE = "agent.write"
    AGENT_PUBLISH = "agent.publish"
    EVALUATION_RUN = "evaluation.run"
    ANALYTICS_READ = "analytics.read"
    MEMBER_MANAGE = "member.manage"
    BILLING_MANAGE = "billing.manage"
    AUDIT_READ = "audit.read"
    AUDIT_EXPORT = "audit.export"
    SETTINGS_VIEW = "settings.view"
    SETTINGS_MANAGE = "settings.manage"


ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.OWNER: set(Permission),

    Role.ADMIN: {
        Permission.AGENT_READ,
        Permission.AGENT_WRITE,
        Permission.AGENT_PUBLISH,
        Permission.EVALUATION_RUN,
        Permission.ANALYTICS_READ,
        Permission.MEMBER_MANAGE,
        Permission.AUDIT_READ,
        Permission.AUDIT_EXPORT,
        Permission.SETTINGS_VIEW,
        Permission.SETTINGS_MANAGE,
    },

    Role.DEVELOPER: {
        Permission.AGENT_READ,
        Permission.AGENT_WRITE,
        Permission.EVALUATION_RUN,
        Permission.ANALYTICS_READ,
        Permission.AUDIT_READ,
        Permission.SETTINGS_VIEW,
    },

    Role.VIEWER: {
        Permission.AGENT_READ,
        Permission.ANALYTICS_READ,
        Permission.AUDIT_READ,
        Permission.SETTINGS_VIEW,
    },
}


def has_permission(role: Role | str, permission: Permission) -> bool:
    """Return True when ``role`` grants ``permission``.

    The role may be the application enum, the persisted database enum or a
    plain role string; all three are normalized before the lookup so that a
    membership read from the database resolves to the same grants.
    """
    raw = getattr(role, "value", role)
    try:
        resolved = Role(str(raw))
    except ValueError:
        return False
    return permission in ROLE_PERMISSIONS.get(resolved, set())