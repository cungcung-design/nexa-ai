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


ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.OWNER: set(Permission),

    Role.ADMIN: {
        Permission.AGENT_READ,
        Permission.AGENT_WRITE,
        Permission.AGENT_PUBLISH,
        Permission.EVALUATION_RUN,
        Permission.ANALYTICS_READ,
        Permission.MEMBER_MANAGE,
    },

    Role.DEVELOPER: {
        Permission.AGENT_READ,
        Permission.AGENT_WRITE,
        Permission.EVALUATION_RUN,
        Permission.ANALYTICS_READ,
    },

    Role.VIEWER: {
        Permission.AGENT_READ,
        Permission.ANALYTICS_READ,
    },
}


def has_permission(role: Role, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())