#!/usr/bin/env bash

set -euo pipefail

echo "=== Nexa AI Production Deployment ==="

COMPOSE=(
  docker compose
  --env-file .env.production
  -f compose.yaml
  -f compose.prod.yaml
)

echo "1. Validating configuration..."
"${COMPOSE[@]}" config --quiet
echo "   Configuration valid."

echo "2. Building and starting services..."
"${COMPOSE[@]}" up -d --build

echo "3. Waiting for PostgreSQL and Redis..."
sleep 15

echo "4. Running database migrations..."
"${COMPOSE[@]}" exec api alembic upgrade head

echo "5. Checking service health..."
"${COMPOSE[@]}" ps

echo ""
echo "=== Deployment complete ==="
echo "Frontend: https://$APP_DOMAIN"
echo "API: https://$API_DOMAIN"
echo ""
echo "Verify with:"
echo "  curl -fk https://\$API_DOMAIN/health"
echo "  curl -fk https://\$API_DOMAIN/ready"
