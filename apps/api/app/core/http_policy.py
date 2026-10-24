"""Explicit browser origins and hostnames for the public API."""

from __future__ import annotations


def _hostname(value: str) -> str:
    host = value.strip().lower()
    if "://" in host:
        host = host.split("://", 1)[1]
    host = host.split("/", 1)[0]
    if host.startswith("["):
        return host
    return host.split(":", 1)[0]


def resolve_cors_origins(raw: str) -> list[str]:
    """Return the browser origins allowed to call the API with credentials.

    A wildcard is rejected because credentialed CORS cannot be open.
    """
    origins: list[str] = []
    for part in raw.split(","):
        origin = part.strip().rstrip("/")
        if not origin:
            continue
        if origin == "*" or not origin.startswith(("http://", "https://")):
            raise RuntimeError("CORS origins must be explicit http(s) URLs")
        if origin not in origins:
            origins.append(origin)
    if not origins:
        raise RuntimeError("At least one CORS origin is required")
    return origins


def resolve_trusted_hosts(raw: str, *, production: bool) -> list[str]:
    """Return the Host values the API accepts.

    Production always also allows the in-container health check and the
    Docker service name used by the web server. A wildcard is rejected.
    """
    hosts: list[str] = []
    for part in raw.split(","):
        host = _hostname(part)
        if not host:
            continue
        if host == "*":
            raise RuntimeError("TRUSTED_HOSTS cannot contain a wildcard")
        if host not in hosts:
            hosts.append(host)
    if not production:
        return hosts
    if not hosts:
        raise RuntimeError("TRUSTED_HOSTS is required in production")
    for extra in ("localhost", "127.0.0.1", "api"):
        if extra not in hosts:
            hosts.append(extra)
    return hosts
