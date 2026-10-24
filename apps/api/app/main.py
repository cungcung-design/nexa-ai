from contextlib import asynccontextmanager

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from app.ai.workflows.checkpointer import (
    get_approval_graph,
    shutdown_checkpointer,
)
from app.core.config import settings
from app.core.log_safety import install_redacting_logs

install_redacting_logs()
from app.core.environment import is_production, require_production_settings
from app.core.http_policy import resolve_cors_origins, resolve_trusted_hosts
from app.db.session import engine
from app.modules.agents.router import router as agents_router
from app.modules.agents.chat_router import router as agent_chat_router
from app.modules.auth.router import router as auth_router
from app.modules.conversations.router import router as conversations_router
from app.modules.knowledge.router import router as knowledge_router
from app.modules.organizations.router import router as organizations_router
from app.modules.workflows.router import router as workflows_router
from app.modules.billing.public_router import router as public_plans_router
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
from app.modules.onboarding.router import router as onboarding_router
from app.modules.contact.router import router as contact_router

@asynccontextmanager
async def lifespan(_app: FastAPI):
    get_approval_graph()
    yield
    shutdown_checkpointer()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="NEXORA AI Platform",
    lifespan=lifespan,
)

require_production_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=resolve_cors_origins(settings.frontend_url),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

trusted_hosts = resolve_trusted_hosts(
    os.getenv("TRUSTED_HOSTS", ""),
    production=is_production(),
)
if trusted_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted_hosts)

# The production API port is not published. Caddy is the only client that
# should be able to supply X-Forwarded-* headers.
if os.getenv("TRUST_PROXY", "").strip().lower() in {"1", "true", "yes"}:
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

app.include_router(auth_router)
app.include_router(organizations_router)
app.include_router(agents_router)
app.include_router(agent_chat_router)
app.include_router(conversations_router)
app.include_router(workflows_router)
app.include_router(knowledge_router)
app.include_router(billing_router)
app.include_router(public_plans_router)
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
app.include_router(onboarding_router)
app.include_router(contact_router)