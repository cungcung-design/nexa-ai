"""Settings API.

Personal settings are user scoped and live under ``/api/v1/settings``.
Workspace settings are organization scoped and live under
``/api/v1/organizations/{organization_id}/settings``.

Every write is recorded as an audit event with the actor, the timestamp and
the redacted difference between the old and the new value.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.permissions import Permission
from app.core.security import hash_password, verify_password
from app.core.tenant_security import require_permission
from app.db.models import (
    Agent,
    AgentVersion,
    Membership,
    MembershipStatus,
    Organization,
    Role as DbRole,
    User,
)
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.organizations.router import require_membership
from app.modules.security.audit import record_audit_event
from app.modules.settings.models import (
    AgentConfigOverride,
    RunConfigSnapshot,
    WorkflowConfigOverride,
)
from app.modules.settings.schemas import (
    AgentConfigListResponse,
    AgentConfigOverridePayload,
    AgentSummary,
    EffectiveConfigResponse,
    NotificationPreferences,
    NotificationPreferencesUpdate,
    OrganizationSummary,
    OwnershipTransferRequest,
    OwnershipTransferResponse,
    PasswordChangeRequest,
    PasswordChangeResponse,
    PersonalSettingsResponse,
    PersonalSettingsUpdate,
    RunSnapshotListResponse,
    RunSnapshotResponse,
    WorkspaceAi,
    WorkspaceCapabilities,
    WorkspaceData,
    WorkspaceDeleteRequest,
    WorkspaceDeleteResponse,
    WorkspaceGeneral,
    WorkspaceGeneralUpdate,
    WorkspaceSecurity,
    WorkspaceSettingsResponse,
    WorkspaceSettingsUpdate,
    WorkflowOverrideListResponse,
    WorkflowOverrideResponse,
)
from app.modules.settings.service import (
    AI_CAPTURE_MODES,
    APPEARANCES,
    LANGUAGES,
    MANDATORY_NOTIFICATIONS,
    NOTIFICATION_CHANNELS,
    NOTIFICATION_PREFERENCES,
    SESSION_TIMEOUT_MAX,
    SESSION_TIMEOUT_MIN,
    TEMPERATURE_MAX,
    TEMPERATURE_MIN,
    TIMEOUT_MAX,
    TIMEOUT_MIN,
    TOOL_APPROVAL_POLICIES,
    SettingsValidationError,
    get_agent_override,
    get_or_create_user_settings,
    get_or_create_workspace_settings,
    get_workflow_override,
    resolve_effective_config,
    supported_models,
    validate_capture_mode,
    validate_model,
    validate_temperature,
    validate_timeout,
    validate_tool_approval_policy,
)

router = APIRouter(tags=["Settings"])

personal_router = APIRouter(
    prefix="/api/v1/settings",
    tags=["Personal Settings"],
)

workspace_router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/settings",
    tags=["Workspace Settings"],
)


# --- Personal settings ------------------------------------------------------


def _memberships_of(db: Session, user_id: UUID) -> list[Membership]:
    return list(
        db.scalars(
            select(Membership).where(
                Membership.user_id == user_id,
                Membership.status == MembershipStatus.ACTIVE.value,
            )
        ).all()
    )


def _record_for_workspaces(
    db: Session,
    user: User,
    action: str,
    resource_type: str,
    resource_name: str,
    changes: dict,
    summary: str,
) -> None:
    """Record a personal settings change in every workspace of the user."""
    for membership in _memberships_of(db, user.id):
        record_audit_event(
            db,
            organization_id=membership.organization_id,
            actor_user_id=user.id,
            action=action,
            resource_type=resource_type,
            resource_id=user.id,
            resource_name=resource_name,
            changes=changes,
            summary=summary,
        )


def _notification_payload(row) -> NotificationPreferences:
    return NotificationPreferences(
        approvals=row.notify_approvals,
        workflow_failures=row.notify_workflow_failures,
        agent_alerts=row.notify_agent_alerts,
        security_alerts=row.notify_security_alerts,
        billing_updates=row.notify_billing_updates,
        email_channel=row.notification_channel_email,
        in_app_channel=row.notification_channel_in_app,
    )


@personal_router.get("/me", response_model=PersonalSettingsResponse)
def get_personal_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_user_settings(db, current_user.id)
    return PersonalSettingsResponse(
        email=current_user.email,
        full_name=row.full_name,
        job_title=row.job_title,
        language=row.language,
        appearance=row.appearance,
        timezone=row.timezone,
        notifications=_notification_payload(row),
        mandatory_notifications=list(MANDATORY_NOTIFICATIONS),
        supported={
            "languages": list(LANGUAGES),
            "appearances": list(APPEARANCES),
            "notification_types": list(NOTIFICATION_PREFERENCES),
            "notification_channels": list(NOTIFICATION_CHANNELS),
            "profile_photo": False,
            "multi_factor_authentication": False,
            "session_management": False,
        },
    )


@personal_router.patch("/me", response_model=PersonalSettingsResponse)
def update_personal_settings(
    payload: PersonalSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_user_settings(db, current_user.id)
    before = {
        "full_name": row.full_name,
        "job_title": row.job_title,
        "language": row.language,
        "appearance": row.appearance,
        "timezone": row.timezone,
    }

    if payload.language is not None:
        language = payload.language.strip().lower()
        if language not in LANGUAGES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Language is not supported",
            )
        row.language = language
    if payload.appearance is not None:
        appearance = payload.appearance.strip().lower()
        if appearance not in APPEARANCES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Appearance is not supported",
            )
        row.appearance = appearance
    if payload.full_name is not None:
        row.full_name = payload.full_name.strip()
    if payload.job_title is not None:
        row.job_title = payload.job_title.strip()
    if payload.timezone is not None:
        row.timezone = payload.timezone.strip() or "UTC"

    db.commit()
    db.refresh(row)

    after = {
        "full_name": row.full_name,
        "job_title": row.job_title,
        "language": row.language,
        "appearance": row.appearance,
        "timezone": row.timezone,
    }
    _record_for_workspaces(
        db,
        current_user,
        action="user.settings_updated",
        resource_type="user",
        resource_name=current_user.email,
        changes={"before": before, "after": after},
        summary=f"{current_user.email} updated their personal settings.",
    )
    return get_personal_settings(current_user=current_user, db=db)


@personal_router.patch(
    "/me/notifications", response_model=PersonalSettingsResponse
)
def update_notification_preferences(
    payload: NotificationPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = get_or_create_user_settings(db, current_user.id)
    updates = payload.model_dump(exclude_none=True)

    blocked = [
        key
        for key in MANDATORY_NOTIFICATIONS
        if key in updates and updates[key] is False
    ]
    if blocked:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "These notifications are mandatory for the workspace: "
                + ", ".join(blocked)
            ),
        )

    before = _notification_payload(row).model_dump()
    if "approvals" in updates:
        row.notify_approvals = bool(updates["approvals"])
    if "workflow_failures" in updates:
        row.notify_workflow_failures = bool(updates["workflow_failures"])
    if "agent_alerts" in updates:
        row.notify_agent_alerts = bool(updates["agent_alerts"])
    if "security_alerts" in updates:
        row.notify_security_alerts = bool(updates["security_alerts"])
    if "billing_updates" in updates:
        row.notify_billing_updates = bool(updates["billing_updates"])
    if "email_channel" in updates:
        row.notification_channel_email = bool(updates["email_channel"])
    if "in_app_channel" in updates:
        row.notification_channel_in_app = bool(updates["in_app_channel"])

    db.commit()
    db.refresh(row)

    after = _notification_payload(row).model_dump()
    _record_for_workspaces(
        db,
        current_user,
        action="user.notification_preferences_updated",
        resource_type="user",
        resource_name=current_user.email,
        changes={"before": before, "after": after},
        summary=(
            f"{current_user.email} updated their notification preferences."
        ),
    )
    return get_personal_settings(current_user=current_user, db=db)


@personal_router.post("/me/password", response_model=PasswordChangeResponse)
def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The current password is incorrect",
        )
    if verify_password(payload.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The new password must be different from the current one",
        )

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()

    _record_for_workspaces(
        db,
        current_user,
        action="user.password_changed",
        resource_type="user",
        resource_name=current_user.email,
        changes={"before": {}, "after": {"password_changed": True}},
        summary=f"{current_user.email} changed their password.",
    )
    return PasswordChangeResponse(
        ok=True,
        message=(
            "Your password was changed. Existing sessions keep working until "
            "their access token expires."
        ),
    )


# --- Workspace settings -----------------------------------------------------


def _workspace_response(
    db: Session,
    organization: Organization,
    role: str,
    current_user_email: str = "",
) -> WorkspaceSettingsResponse:
    row = get_or_create_workspace_settings(db, organization.id)
    can_manage = role in {DbRole.OWNER.value, DbRole.ADMIN.value}
    return WorkspaceSettingsResponse(
        organization=OrganizationSummary(
            id=organization.id,
            name=organization.name,
            slug=organization.slug,
            role=role,
        ),
        general=WorkspaceGeneral(
            name=organization.name, slug=organization.slug
        ),
        security=WorkspaceSecurity(
            session_timeout_minutes=row.session_timeout_minutes,
            require_tool_approval=row.require_tool_approval,
            mfa_supported=False,
            sessions_supported=False,
            mfa_note=(
                "Multi-factor authentication is not implemented by the "
                "backend, so it cannot be enabled here."
            ),
            sessions_note=(
                "Access tokens are stateless, so there is no session list to "
                "review. Changing the password invalidates nothing until the "
                "current token expires."
            ),
        ),
        ai=WorkspaceAi(
            default_model=row.default_model,
            default_temperature=row.default_temperature,
            default_agent_timeout_seconds=row.default_agent_timeout_seconds,
            default_tool_approval_policy=row.default_tool_approval_policy,
            allowed_models=list(row.allowed_models or []),
            require_tool_approval=row.require_tool_approval,
            capture_mode=row.ai_capture_mode,
            available_models=supported_models(db, organization.id),
            tool_approval_policies=list(TOOL_APPROVAL_POLICIES),
            capture_modes=list(AI_CAPTURE_MODES),
            temperature_range=[TEMPERATURE_MIN, TEMPERATURE_MAX],
            timeout_range=[TIMEOUT_MIN, TIMEOUT_MAX],
        ),
        data=WorkspaceData(
            retention_days=row.retention_days,
            allow_data_export=row.allow_data_export,
            export_scope="Audit log export",
            retention_enforced=False,
            note=(
                "The retention window is stored as workspace policy. "
                "Automatic purging is not implemented by the backend."
            ),
        ),
        capabilities=WorkspaceCapabilities(
            mfa=False,
            sessions=False,
            sso=False,
            data_export=True,
            personal_account_deletion=False,
            workspace_deletion=True,
            ownership_transfer=True,
            workflow_overrides=True,
            run_overrides=True,
        ),
        role=role,
        can_manage=can_manage,
        current_user_email=current_user_email,
    )


@workspace_router.get("", response_model=WorkspaceSettingsResponse)
def get_workspace_settings(
    organization_id: UUID,
    membership=Depends(require_permission(Permission.SETTINGS_VIEW)),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _workspace_response(
        db,
        membership.organization,
        membership.role.value,
        current_user.email,
    )


@workspace_router.patch("", response_model=WorkspaceSettingsResponse)
def update_workspace_settings(
    organization_id: UUID,
    payload: WorkspaceSettingsUpdate,
    membership=Depends(require_permission(Permission.SETTINGS_MANAGE)),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    organization = membership.organization
    row = get_or_create_workspace_settings(db, organization_id)

    if payload.general is not None:
        before = {"name": organization.name, "slug": organization.slug}
        if payload.general.name is not None:
            organization.name = payload.general.name.strip()
        if payload.general.slug is not None:
            organization.slug = payload.general.slug.strip().lower()
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That workspace slug is already in use",
            )
        db.refresh(organization)
        record_audit_event(
            db,
            organization_id=organization_id,
            actor_user_id=current_user.id,
            action="workspace.settings_updated",
            resource_type="workspace",
            resource_id=organization_id,
            resource_name=organization.name,
            changes={
                "before": before,
                "after": {
                    "name": organization.name,
                    "slug": organization.slug,
                },
            },
            summary=f"{current_user.email} updated the workspace details.",
        )

    if payload.security is not None:
        before = {
            "session_timeout_minutes": row.session_timeout_minutes,
            "require_tool_approval": row.require_tool_approval,
        }
        if payload.security.session_timeout_minutes is not None:
            value = payload.security.session_timeout_minutes
            if not SESSION_TIMEOUT_MIN <= value <= SESSION_TIMEOUT_MAX:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        "Session timeout must be between "
                        f"{SESSION_TIMEOUT_MIN} and {SESSION_TIMEOUT_MAX} "
                        "minutes"
                    ),
                )
            row.session_timeout_minutes = value
        if payload.security.require_tool_approval is not None:
            row.require_tool_approval = bool(
                payload.security.require_tool_approval
            )
        db.commit()
        db.refresh(row)
        record_audit_event(
            db,
            organization_id=organization_id,
            actor_user_id=current_user.id,
            action="workspace.settings_updated",
            resource_type="workspace",
            resource_id=organization_id,
            resource_name=organization.name,
            changes={
                "before": before,
                "after": {
                    "session_timeout_minutes": row.session_timeout_minutes,
                    "require_tool_approval": row.require_tool_approval,
                },
            },
            summary=f"{current_user.email} updated the workspace security policy.",
        )

    if payload.data is not None:
        before = {
            "retention_days": row.retention_days,
            "allow_data_export": row.allow_data_export,
        }
        if payload.data.retention_days is not None:
            row.retention_days = payload.data.retention_days
        if payload.data.allow_data_export is not None:
            row.allow_data_export = bool(payload.data.allow_data_export)
        db.commit()
        db.refresh(row)
        record_audit_event(
            db,
            organization_id=organization_id,
            actor_user_id=current_user.id,
            action="workspace.settings_updated",
            resource_type="workspace",
            resource_id=organization_id,
            resource_name=organization.name,
            changes={
                "before": before,
                "after": {
                    "retention_days": row.retention_days,
                    "allow_data_export": row.allow_data_export,
                },
            },
            summary=f"{current_user.email} updated the workspace data policy.",
        )

    if payload.ai is not None:
        before = {
            "default_model": row.default_model,
            "default_temperature": row.default_temperature,
            "default_agent_timeout_seconds": (
                row.default_agent_timeout_seconds
            ),
            "default_tool_approval_policy": (
                row.default_tool_approval_policy
            ),
            "allowed_models": list(row.allowed_models or []),
            "require_tool_approval": row.require_tool_approval,
            "capture_mode": row.ai_capture_mode,
        }
        try:
            if payload.ai.default_model is not None:
                row.default_model = validate_model(
                    db, organization_id, payload.ai.default_model
                )
            if payload.ai.default_temperature is not None:
                row.default_temperature = validate_temperature(
                    payload.ai.default_temperature
                )
            if payload.ai.default_agent_timeout_seconds is not None:
                row.default_agent_timeout_seconds = validate_timeout(
                    payload.ai.default_agent_timeout_seconds
                )
            if payload.ai.default_tool_approval_policy is not None:
                row.default_tool_approval_policy = (
                    validate_tool_approval_policy(
                        payload.ai.default_tool_approval_policy
                    )
                )
            if payload.ai.allowed_models is not None:
                allowed: list[str] = []
                for model in payload.ai.allowed_models:
                    cleaned = (model or "").strip()
                    if not cleaned:
                        continue
                    validate_model(db, organization_id, cleaned)
                    if cleaned not in allowed:
                        allowed.append(cleaned)
                row.allowed_models = allowed
            if payload.ai.require_tool_approval is not None:
                row.require_tool_approval = bool(
                    payload.ai.require_tool_approval
                )
            if payload.ai.capture_mode is not None:
                row.ai_capture_mode = validate_capture_mode(
                    payload.ai.capture_mode
                )
        except SettingsValidationError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            )
        db.commit()
        db.refresh(row)
        record_audit_event(
            db,
            organization_id=organization_id,
            actor_user_id=current_user.id,
            action="workspace.ai_configuration_updated",
            resource_type="workspace",
            resource_id=organization_id,
            resource_name=organization.name,
            changes={
                "before": before,
                "after": {
                    "default_model": row.default_model,
                    "default_temperature": row.default_temperature,
                    "default_agent_timeout_seconds": (
                        row.default_agent_timeout_seconds
                    ),
                    "default_tool_approval_policy": (
                        row.default_tool_approval_policy
                    ),
                    "allowed_models": list(row.allowed_models or []),
                    "require_tool_approval": row.require_tool_approval,
                    "capture_mode": row.ai_capture_mode,
                },
            },
            summary=(
                f"{current_user.email} updated the workspace AI configuration."
            ),
        )

    db.refresh(membership)
    return _workspace_response(
        db, organization, membership.role.value, current_user.email
    )


# --- AI configuration -------------------------------------------------------


def _version_for(
    db: Session, organization_id: UUID, agent_id: UUID, version_id: UUID
) -> AgentVersion:
    version = db.scalar(
        select(AgentVersion).where(
            AgentVersion.id == version_id,
            AgentVersion.agent_id == agent_id,
            AgentVersion.organization_id == organization_id,
        )
    )
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent version not found",
        )
    return version


@workspace_router.get("/ai/effective", response_model=EffectiveConfigResponse)
def get_effective_config(
    organization_id: UUID,
    agent_id: UUID,
    version_id: UUID,
    workflow_key: str | None = None,
    membership=Depends(require_permission(Permission.SETTINGS_VIEW)),
    db: Session = Depends(get_db),
):
    version = _version_for(db, organization_id, agent_id, version_id)
    agent = db.get(Agent, agent_id)
    resolved = resolve_effective_config(
        db,
        organization_id,
        version,
        workflow_key=workflow_key,
    )
    agent_override = get_agent_override(db, version.id)
    workflow_override = (
        get_workflow_override(db, organization_id, workflow_key)
        if workflow_key
        else None
    )
    return EffectiveConfigResponse(
        agent={
            "id": str(agent.id) if agent else None,
            "name": agent.name if agent else None,
            "version_id": str(version.id),
            "version_number": version.version_number,
        },
        settings=resolved["settings"],
        capture_mode=resolved["capture_mode"],
        restrictions=resolved["restrictions"],
        agent_override=(
            AgentConfigOverridePayload(
                model=agent_override.model,
                temperature=agent_override.temperature,
                agent_timeout_seconds=agent_override.agent_timeout_seconds,
                tool_approval_policy=(
                    agent_override.tool_approval_policy
                ),
            )
            if agent_override
            else None
        ),
        workflow_override=(
            AgentConfigOverridePayload(
                model=workflow_override.model,
                temperature=workflow_override.temperature,
                agent_timeout_seconds=(
                    workflow_override.agent_timeout_seconds
                ),
                tool_approval_policy=workflow_override.tool_approval_policy,
            )
            if workflow_override
            else None
        ),
    )


@workspace_router.get("/ai/agents", response_model=AgentConfigListResponse)
def list_agent_configs(
    organization_id: UUID,
    membership=Depends(require_permission(Permission.SETTINGS_VIEW)),
    db: Session = Depends(get_db),
):
    agents = db.scalars(
        select(Agent)
        .where(
            Agent.organization_id == organization_id,
            Agent.is_archived.is_(False),
        )
        .order_by(Agent.name)
    ).all()

    items: list[AgentSummary] = []
    for agent in agents:
        version = (
            db.get(AgentVersion, agent.published_version_id)
            if agent.published_version_id
            else None
        )
        override = (
            get_agent_override(db, version.id) if version is not None else None
        )
        items.append(
            AgentSummary(
                id=agent.id,
                name=agent.name,
                published_version_id=agent.published_version_id,
                version_number=(
                    version.version_number if version is not None else None
                ),
                override=(
                    AgentConfigOverridePayload(
                        model=override.model,
                        temperature=override.temperature,
                        agent_timeout_seconds=override.agent_timeout_seconds,
                        tool_approval_policy=override.tool_approval_policy,
                    )
                    if override is not None
                    else None
                ),
                inherited=override is None,
            )
        )
    return AgentConfigListResponse(items=items)


@workspace_router.get(
    "/ai/overrides/{agent_id}/{version_id}",
    response_model=AgentConfigOverridePayload | None,
)
def get_agent_override_endpoint(
    organization_id: UUID,
    agent_id: UUID,
    version_id: UUID,
    membership=Depends(require_permission(Permission.SETTINGS_VIEW)),
    db: Session = Depends(get_db),
):
    version = _version_for(db, organization_id, agent_id, version_id)
    override = get_agent_override(db, version.id)
    if override is None:
        return None
    return AgentConfigOverridePayload(
        model=override.model,
        temperature=override.temperature,
        agent_timeout_seconds=override.agent_timeout_seconds,
        tool_approval_policy=override.tool_approval_policy,
    )


@workspace_router.put(
    "/ai/overrides/{agent_id}/{version_id}",
    response_model=AgentConfigOverridePayload,
)
def put_agent_override(
    organization_id: UUID,
    agent_id: UUID,
    version_id: UUID,
    payload: AgentConfigOverridePayload,
    membership=Depends(require_permission(Permission.AGENT_WRITE)),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    version = _version_for(db, organization_id, agent_id, version_id)
    try:
        model = validate_model(db, organization_id, payload.model)
        temperature = validate_temperature(payload.temperature)
        timeout = validate_timeout(payload.agent_timeout_seconds)
        policy = validate_tool_approval_policy(payload.tool_approval_policy)
    except SettingsValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    override = get_agent_override(db, version.id)
    if override is None:
        override = AgentConfigOverride(
            organization_id=organization_id,
            agent_id=agent_id,
            agent_version_id=version.id,
        )
        db.add(override)
    before = {
        "model": override.model,
        "temperature": override.temperature,
        "agent_timeout_seconds": override.agent_timeout_seconds,
        "tool_approval_policy": override.tool_approval_policy,
    }
    override.model = model
    override.temperature = temperature
    override.agent_timeout_seconds = timeout
    override.tool_approval_policy = policy
    db.commit()
    db.refresh(override)

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="workspace.agent_config_override_updated",
        resource_type="agent_version",
        resource_id=version.id,
        resource_name=f"v{version.version_number}",
        details={"agent_id": str(agent_id)},
        changes={
            "before": before,
            "after": {
                "model": override.model,
                "temperature": override.temperature,
                "agent_timeout_seconds": override.agent_timeout_seconds,
                "tool_approval_policy": override.tool_approval_policy,
            },
        },
        summary=(
            f"{current_user.email} updated the configuration override of "
            f"agent version v{version.version_number}."
        ),
    )
    return AgentConfigOverridePayload(
        model=override.model,
        temperature=override.temperature,
        agent_timeout_seconds=override.agent_timeout_seconds,
        tool_approval_policy=override.tool_approval_policy,
    )


@workspace_router.delete(
    "/ai/overrides/{agent_id}/{version_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_agent_override(
    organization_id: UUID,
    agent_id: UUID,
    version_id: UUID,
    membership=Depends(require_permission(Permission.AGENT_WRITE)),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    version = _version_for(db, organization_id, agent_id, version_id)
    override = get_agent_override(db, version.id)
    if override is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This agent version has no configuration override",
        )
    before = {
        "model": override.model,
        "temperature": override.temperature,
        "agent_timeout_seconds": override.agent_timeout_seconds,
        "tool_approval_policy": override.tool_approval_policy,
    }
    db.delete(override)
    db.commit()

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="workspace.agent_config_override_reset",
        resource_type="agent_version",
        resource_id=version.id,
        resource_name=f"v{version.version_number}",
        details={"agent_id": str(agent_id)},
        changes={"before": before, "after": {}},
        summary=(
            f"{current_user.email} reset the configuration override of agent "
            f"version v{version.version_number} to the inherited value."
        ),
    )
    return None


@workspace_router.get("/ai/workflows", response_model=WorkflowOverrideListResponse)
def list_workflow_overrides(
    organization_id: UUID,
    membership=Depends(require_permission(Permission.SETTINGS_VIEW)),
    db: Session = Depends(get_db),
):
    rows = db.scalars(
        select(WorkflowConfigOverride).where(
            WorkflowConfigOverride.organization_id == organization_id
        )
    ).all()
    return WorkflowOverrideListResponse(
        items=[
            WorkflowOverrideResponse(
                workflow_key=row.workflow_key,
                override=AgentConfigOverridePayload(
                    model=row.model,
                    temperature=row.temperature,
                    agent_timeout_seconds=row.agent_timeout_seconds,
                    tool_approval_policy=row.tool_approval_policy,
                ),
            )
            for row in rows
        ]
    )


@workspace_router.put(
    "/ai/workflows/{workflow_key}", response_model=AgentConfigOverridePayload
)
def put_workflow_override(
    organization_id: UUID,
    workflow_key: str,
    payload: AgentConfigOverridePayload,
    membership=Depends(require_permission(Permission.SETTINGS_MANAGE)),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        model = validate_model(db, organization_id, payload.model)
        temperature = validate_temperature(payload.temperature)
        timeout = validate_timeout(payload.agent_timeout_seconds)
        policy = validate_tool_approval_policy(payload.tool_approval_policy)
    except SettingsValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    override = get_workflow_override(db, organization_id, workflow_key)
    if override is None:
        override = WorkflowConfigOverride(
            organization_id=organization_id,
            workflow_key=workflow_key,
        )
        db.add(override)
    before = {
        "model": override.model,
        "temperature": override.temperature,
        "agent_timeout_seconds": override.agent_timeout_seconds,
        "tool_approval_policy": override.tool_approval_policy,
    }
    override.model = model
    override.temperature = temperature
    override.agent_timeout_seconds = timeout
    override.tool_approval_policy = policy
    db.commit()
    db.refresh(override)

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="workspace.workflow_config_override_updated",
        resource_type="workflow",
        resource_name=workflow_key,
        changes={
            "before": before,
            "after": {
                "model": override.model,
                "temperature": override.temperature,
                "agent_timeout_seconds": override.agent_timeout_seconds,
                "tool_approval_policy": override.tool_approval_policy,
            },
        },
        summary=(
            f"{current_user.email} updated the configuration override of "
            f"workflow “{workflow_key}”."
        ),
    )
    return AgentConfigOverridePayload(
        model=override.model,
        temperature=override.temperature,
        agent_timeout_seconds=override.agent_timeout_seconds,
        tool_approval_policy=override.tool_approval_policy,
    )


@workspace_router.delete(
    "/ai/workflows/{workflow_key}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_workflow_override(
    organization_id: UUID,
    workflow_key: str,
    membership=Depends(require_permission(Permission.SETTINGS_MANAGE)),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    override = get_workflow_override(db, organization_id, workflow_key)
    if override is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This workflow has no configuration override",
        )
    before = {
        "model": override.model,
        "temperature": override.temperature,
        "agent_timeout_seconds": override.agent_timeout_seconds,
        "tool_approval_policy": override.tool_approval_policy,
    }
    db.delete(override)
    db.commit()

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="workspace.workflow_config_override_reset",
        resource_type="workflow",
        resource_name=workflow_key,
        changes={"before": before, "after": {}},
        summary=(
            f"{current_user.email} reset the configuration override of "
            f"workflow “{workflow_key}” to the inherited value."
        ),
    )
    return None


@workspace_router.get("/runs", response_model=RunSnapshotListResponse)
def list_run_snapshots(
    organization_id: UUID,
    limit: int = 50,
    membership=Depends(require_permission(Permission.SETTINGS_VIEW)),
    db: Session = Depends(get_db),
):
    rows = db.scalars(
        select(RunConfigSnapshot)
        .where(RunConfigSnapshot.organization_id == organization_id)
        .order_by(RunConfigSnapshot.created_at.desc())
        .limit(max(1, min(limit, 200)))
    ).all()
    return RunSnapshotListResponse(
        items=[
            RunSnapshotResponse(
                id=row.id,
                agent_id=row.agent_id,
                agent_version_id=row.agent_version_id,
                workflow_key=row.workflow_key,
                run_id=row.run_id,
                resolved_config=row.resolved_config,
                sources=row.sources,
                created_at=row.created_at.isoformat(),
            )
            for row in rows
        ]
    )


# --- Ownership and lifecycle ------------------------------------------------


@workspace_router.post(
    "/ownership/transfer", response_model=OwnershipTransferResponse
)
def transfer_ownership(
    organization_id: UUID,
    payload: OwnershipTransferRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = require_membership(
        db,
        current_user.id,
        organization_id,
        allowed_roles=[DbRole.OWNER],
    )
    target = db.scalar(
        select(Membership).where(
            Membership.id == payload.membership_id,
            Membership.organization_id == organization_id,
        )
    )
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That member is not part of this workspace",
        )
    if (target.status or MembershipStatus.ACTIVE.value) != (
        MembershipStatus.ACTIVE.value
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A suspended member cannot become the workspace owner",
        )
    if target.id == membership.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The workspace already belongs to you",
        )

    other_owners = db.scalar(
        select(Membership)
        .where(
            Membership.organization_id == organization_id,
            Membership.role == DbRole.OWNER,
            Membership.status == MembershipStatus.ACTIVE.value,
            Membership.id != membership.id,
        )
    )
    before = {
        "owner_email": current_user.email,
        "target_email": target.user.email if target.user else None,
    }
    target.role = DbRole.OWNER
    # The workspace keeps at least one active owner: when the current owner
    # was the last one they step down to admin, otherwise the role stays.
    if other_owners is None:
        membership.role = DbRole.ADMIN
    db.commit()
    db.refresh(target)

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="workspace.ownership_transferred",
        resource_type="workspace",
        resource_id=organization_id,
        resource_name=membership.organization.name,
        changes={
            "before": before,
            "after": {"owner_email": target.user.email if target.user else None},
        },
        summary=(
            f"{current_user.email} transferred the workspace ownership to "
            f"{target.user.email if target.user else 'another member'}."
        ),
    )
    return OwnershipTransferResponse(
        ok=True,
        new_owner=target.user.email if target.user else "",
        message=(
            "Ownership was transferred. The new owner is responsible for the "
            "workspace from now on."
        ),
    )


@workspace_router.post("/delete", response_model=WorkspaceDeleteResponse)
def delete_workspace(
    organization_id: UUID,
    payload: WorkspaceDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = require_membership(
        db,
        current_user.id,
        organization_id,
        allowed_roles=[DbRole.OWNER],
    )
    organization = membership.organization
    if payload.confirm_name.strip() != organization.name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Type the exact workspace name to confirm the deletion: "
                f"“{organization.name}”"
            ),
        )

    record_audit_event(
        db,
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="workspace.deleted",
        resource_type="workspace",
        resource_id=organization_id,
        resource_name=organization.name,
        changes={"before": {"name": organization.name}, "after": {}},
        summary=(
            f"{current_user.email} deleted the workspace "
            f"“{organization.name}”."
        ),
    )

    db.delete(organization)
    db.commit()
    return WorkspaceDeleteResponse(
        ok=True,
        message=(
            "The workspace and everything in it was deleted. This removes the "
            "workspace audit trail as well."
        ),
    )


__all__ = ["router", "personal_router", "workspace_router"]
