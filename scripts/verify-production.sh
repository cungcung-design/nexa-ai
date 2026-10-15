#!/usr/bin/env bash

set -euo pipefail

COMPOSE=(
  docker compose
  --env-file .env.production
  -f compose.yaml
  -f compose.prod.yaml
)

APP_DOMAIN="${APP_DOMAIN:-app.example.com}"
API_DOMAIN="${API_DOMAIN:-api.example.com}"

echo "=== Nexa AI Production Verification ==="
echo ""

echo "1. Service status..."
"${COMPOSE[@]}" ps

echo ""
echo "2. PostgreSQL health..."
"${COMPOSE[@]}" exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo ""
echo "3. Redis health..."
"${COMPOSE[@]}" exec -T redis redis-cli ping

echo ""
echo "4. Alembic migration status..."
"${COMPOSE[@]}" exec -T api alembic current

echo ""
echo "5. FastAPI liveness..."
"${COMPOSE[@]}" exec -T api curl -sf http://127.0.0.1:8000/health || echo "  (Use Caddy for public HTTPS health check)"

echo ""
echo "6. Caddy HTTPS check..."
if curl -sf "https://$API_DOMAIN/health" >/dev/null 2>&1; then
  echo "  API reachable via HTTPS: PASS"
else
  echo "  API HTTPS check: FAILED (check domains and DNS)"
fi

if curl -sf "https://$APP_DOMAIN" >/dev/null 2>&1; then
  echo "  Frontend reachable via HTTPS: PASS"
else
  echo "  Frontend HTTPS check: FAILED (check domains and DNS)"
fi

echo ""
echo "=== Verification complete ==="
