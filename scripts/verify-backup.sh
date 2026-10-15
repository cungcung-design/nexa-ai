#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup-file>"
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found"
  exit 1
fi

COMPOSE=(
  docker compose
  --env-file .env.production
  -f compose.yaml
  -f compose.prod.yaml
)

TEST_DB="nexa_restore_test"

echo "Preparing isolated restore database..."

"${COMPOSE[@]}" exec -T postgres \
  sh -c "psql -U \"\$POSTGRES_USER\" -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE $TEST_DB;'"

echo "Restoring backup..."

cat "$BACKUP_FILE" | \
  "${COMPOSE[@]}" exec -T postgres \
  sh -c "pg_restore -U \"\$POSTGRES_USER\" -d $TEST_DB --no-owner --no-acl --exit-on-error"

echo "Checking restored database..."

"${COMPOSE[@]}" exec -T postgres \
  sh -c "psql -U \"\$POSTGRES_USER\" -d $TEST_DB -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '\''public'\'';'"

echo "Restore verification completed."
echo "Review the result, then remove $TEST_DB manually."
