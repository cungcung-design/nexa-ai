"""Render the production Compose project with dummy values.

The dummy file is temporary and is not a deployment environment. The command
prints assertion results only. It does not print the rendered config.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

DUMMY = """
ENVIRONMENT=production
APP_ENV=production
POSTGRES_USER=nexa_ci
POSTGRES_PASSWORD=CiDummyPass1
POSTGRES_DB=nexa_ci_config
REDIS_URL=redis://redis:6379/0
JWT_SECRET=ci-compose-dummy-jwt-secret-value-32
FRONTEND_URL=https://staging.example.com
NEXA_API_URL=http://api:8000
NEXT_PUBLIC_API_URL=https://api.staging.example.com
LLM_BASE_URL=https://llm.example.net/v1
LLM_API_KEY=ci-dummy-llm-key
SMTP_HOST=smtp.example-mail.net
SMTP_PORT=587
SMTP_USERNAME=ci-mailbox
SMTP_PASSWORD=CiDummyMailbox1
SMTP_FROM_EMAIL=ops@example-mail.net
SMTP_USE_STARTTLS=true
SMTP_USE_SSL=false
STRIPE_SECRET_KEY=sk_test_ci_dummy
STRIPE_WEBHOOK_SECRET=whsec_ci_dummy
STRIPE_STARTER_PRICE_ID=price_ci_starter
STRIPE_STARTER_YEARLY_PRICE_ID=price_ci_starter_year
STRIPE_PRO_PRICE_ID=price_ci_pro
STRIPE_PRO_YEARLY_PRICE_ID=price_ci_pro_year
APP_DOMAIN=staging.example.com
API_DOMAIN=api.staging.example.com
LETSENCRYPT_EMAIL=ops@example-mail.net
""".strip() + "\n"


def _ports(service: dict) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    for port in service.get("ports") or []:
        published = str(port.get("published", ""))
        protocol = str(port.get("protocol", "tcp"))
        if published:
            found.append((published, protocol))
    return found


def _require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def _check_prod(config: dict) -> list[str]:
    failures: list[str] = []
    _require(config.get("name") == "nexa-staging", "project name is not nexa-staging", failures)
    services = config.get("services") or {}
    expected = {"caddy", "postgres", "redis", "migrate", "api", "worker", "web"}
    _require(expected <= set(services), "production services are missing", failures)
    for name in ("postgres", "redis", "api", "worker", "web"):
        _require(not _ports(services.get(name, {})), f"{name} publishes a host port", failures)
    caddy_ports = set(_ports(services.get("caddy", {})))
    _require(
        caddy_ports == {("80", "tcp"), ("443", "tcp"), ("443", "udp")},
        "caddy ports are not 80/tcp, 443/tcp, and 443/udp",
        failures,
    )
    api = services.get("api", {})
    environment = api.get("environment") or {}
    _require(environment.get("TRUST_PROXY") == "true", "API TRUST_PROXY is not true", failures)
    _require(
        str(environment.get("STRIPE_SECRET_KEY", "")).startswith("sk_test_"),
        "API Stripe secret is not a test key",
        failures,
    )
    _require(
        "sk_live_" not in json.dumps(environment.get("STRIPE_SECRET_KEY", "")),
        "API Stripe secret is live",
        failures,
    )
    _require(
        environment.get("SMTP_USE_STARTTLS") == "true",
        "SMTP_USE_STARTTLS was not passed through",
        failures,
    )
    _require(environment.get("SMTP_USE_SSL") == "false", "SMTP_USE_SSL was not passed through", failures)
    database_url = str(environment.get("DATABASE_URL", ""))
    _require("@postgres:5432/nexa_ci_config" in database_url, "API database is not the dummy database", failures)
    _require("nexa_ai" not in database_url.rsplit("/", 1)[-1], "API database name is the development name", failures)
    web = services.get("web", {})
    web_env = web.get("environment") or {}
    _require(web_env.get("COOKIE_SECURE") == "true", "web COOKIE_SECURE is not true", failures)
    _require(api.get("image") == "nexa-api:compose", "API image default changed", failures)
    _require(services.get("worker", {}).get("image") == "nexa-worker:compose", "worker image default changed", failures)
    _require(web.get("image") == "nexa-web:compose", "web image default changed", failures)
    for name in ("caddy", "postgres", "redis", "migrate", "api", "worker", "web"):
        logging_config = services.get(name, {}).get("logging") or {}
        options = logging_config.get("options") or {}
        _require(logging_config.get("driver") == "json-file", f"{name} logs are not json-file", failures)
        _require(options.get("max-size") == "10m", f"{name} log size is not bounded", failures)
        _require(str(options.get("max-file")) == "5", f"{name} log file count is not bounded", failures)
    for name in ("migrate", "api", "worker", "web"):
        dropped = services.get(name, {}).get("cap_drop") or []
        _require("ALL" in dropped, f"{name} does not drop all capabilities", failures)
        options = services.get(name, {}).get("security_opt") or []
        _require(
            "no-new-privileges:true" in options,
            f"{name} does not set no-new-privileges",
            failures,
        )
    migrate = services.get("migrate", {})
    command = migrate.get("command") or []
    _require(command[-2:] == ["python", "scripts/migrate.py"] or "scripts/migrate.py" in command, "migrate command changed", failures)
    return failures


def _render(env_file: Path, project: str, files: list[str]) -> dict:
    command = ["docker", "compose", "--env-file", str(env_file), "-p", project]
    for file_name in files:
        command.extend(["-f", file_name])
    command.extend(["config", "--format", "json"])
    env = os.environ.copy()
    for name in ("NEXA_API_IMAGE", "NEXA_WORKER_IMAGE", "NEXA_WEB_IMAGE"):
        env.pop(name, None)
    completed = subprocess.run(
        command,
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        print("compose-config-failed")
        sys.exit(completed.returncode)
    return json.loads(completed.stdout)


def main() -> int:
    with tempfile.TemporaryDirectory() as directory:
        env_file = Path(directory) / "ci.env"
        env_file.write_text(DUMMY, encoding="utf-8")
        config = _render(
            env_file,
            "nexa-staging",
            ["compose.yaml", "compose.prod.yaml"],
        )
        check = subprocess.run(
            [sys.executable, "deploy/check_vps_env.py", str(env_file), "vps"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
    failures = _check_prod(config)
    if check.returncode != 0:
        failures.append("dummy vps env check failed")
    if failures:
        print("fail " + "; ".join(failures))
        return 1
    print("compose-config-ok")
    if "--include-local" in sys.argv:
        return _check_local_staging()
    return 0


def _check_local_staging() -> int:
    env_file = ROOT / ".env.staging.local"
    if not env_file.exists():
        print("local-staging-config-skipped")
        return 0
    config = _render(
        env_file,
        "nexa-staging-local",
        ["compose.yaml", "compose.prod.yaml", "compose.local-staging.yaml"],
    )
    failures: list[str] = []
    _require(config.get("name") == "nexa-staging-local", "local project name changed", failures)
    services = config.get("services") or {}
    api_ports = _ports(services.get("api", {}))
    _require(("18000", "tcp") in api_ports, "local API port is not loopback 18000", failures)
    environment = (services.get("api", {}).get("environment") or {})
    _require(environment.get("TRUST_PROXY") == "false", "local API proxy trust changed", failures)
    database_name = str(environment.get("DATABASE_URL", "")).rsplit("/", 1)[-1]
    _require(database_name != "nexa_ai", "local staging points at the development database", failures)
    if failures:
        print("fail " + "; ".join(failures))
        return 1
    print("local-staging-config-ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
