#!/usr/bin/env bash

set -euo pipefail

COMPOSE=(
  docker compose
  --env-file .env.production
  -f compose.yaml
  -f compose.prod.yaml
)

BACKUP_DIR="${BACKUP_DIR:-./backups}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/nexa_ai_$TIMESTAMP.dump"

echo "Starting PostgreSQL backup..."

"${COMPOSE[@]}" exec -T postgres \
  sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$BACKUP_FILE"

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "Backup failed: empty file"
  rm -f "$BACKUP_FILE"
  exit 1
fi

echo "Backup created: $BACKUP_FILE"
echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
