from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.environment import require_production_settings
from app.db.session import engine
from app.modules.agents.router import router as agents_router
from app.modules.agents.chat_router import router as agent_chat_router
from app.modules.auth.router import router as auth_router
from app.modules.conversations.router import router as conversations_router
from app.modules.knowledge.router import router as knowledge_router
from app.modules.organizations.router import router as organizations_router
from app.modules.workflows.router import router as workflows_router
from app.modules.billing.router import router as billing_router
from app.modules.billing.webhook_router import router as billing_webhook_router
from app.modules.integrations.router import router as integrations_router
from app.modules.deployments.router import router as deployments_router
from app.modules.public_chat.router import router as public_chat_router
from app.modules.analytics.evaluation_router import router as evaluation_router
from app.modules.analytics.router import router as analytics_router
from app.modules.security.router import router as security_router
from app.modules.security.management_router import router as api_key_management_router
from app.modules.security.audit_router import router as audit_router
from app.modules.approvals.router import router as approvals_router
from app.modules.team.router import router as team_router
from app.modules.team.invitation_router import router as team_invitation_router
from app.modules.settings.router import (
    personal_router as personal_settings_router,
    workspace_router as workspace_settings_router,
)
from app.modules.health.router import router as health_router

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Nexa AI SaaS Backend",
)

require_production_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(organizations_router)
app.include_router(agents_router)
app.include_router(agent_chat_router)
app.include_router(conversations_router)
app.include_router(workflows_router)
app.include_router(knowledge_router)
app.include_router(billing_router)
app.include_router(billing_webhook_router)
app.include_router(deployments_router)
app.include_router(integrations_router)
app.include_router(public_chat_router)
app.include_router(evaluation_router)
app.include_router(analytics_router)
app.include_router(security_router)
app.include_router(api_key_management_router)
app.include_router(audit_router)
app.include_router(approvals_router)
app.include_router(team_router)
app.include_router(team_invitation_router)
app.include_router(personal_settings_router)
app.include_router(workspace_settings_router)
app.include_router(health_router)