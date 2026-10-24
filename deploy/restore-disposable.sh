#!/bin/sh
# Restore one backup into the empty nexa-restore-check project.
# Refuses the development project, the active local staging project,
# and any database published on the development or staging host ports.

set -eu

PROJECT="nexa-restore-check"
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
BACKUP_DIR="${BACKUP_DIR:-}"
ENV_FILE="${ENV_FILE:-$ROOT/.env.restore-check}"
COMPOSE="docker compose --env-file $ENV_FILE -p $PROJECT -f $ROOT/compose.restore-check.yaml"

if [ -z "$BACKUP_DIR" ] || [ ! -f "$BACKUP_DIR/database.dump" ]; then
  echo "BACKUP_DIR must point at a backup directory that contains database.dump" >&2
  exit 1
fi
BACKUP_DIR=$(CDPATH= cd -- "$BACKUP_DIR" && pwd)
if [ ! -f "$ENV_FILE" ]; then
  echo "missing $ENV_FILE" >&2
  exit 1
fi
if [ "${COMPOSE_PROJECT_NAME:-$PROJECT}" != "$PROJECT" ]; then
  echo "refusing project ${COMPOSE_PROJECT_NAME}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

case "${POSTGRES_DB:-}" in
  nexa_ai|nexa_ai_staging) echo "refusing database ${POSTGRES_DB}" >&2; exit 1 ;;
esac
case "${POSTGRES_USER:-}" in
  nexa|nexa_staging) echo "refusing database user ${POSTGRES_USER}" >&2; exit 1 ;;
esac

for target in \
  "${PROJECT}_restore_postgres_data" \
  "${PROJECT}_document_storage" \
  "${PROJECT}_audit_export_storage"
do
  case "$target" in
    nexa_postgres_data|nexa-ai_*|nexa-staging-local_*)
      echo "refusing volume $target" >&2
      exit 1
      ;;
  esac
done

$COMPOSE up -d postgres
ready=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  state=$(docker inspect nexa-restore-check-postgres --format '{{.State.Health.Status}}' 2>/dev/null || true)
  if [ "$state" = "healthy" ]; then
    ready=1
    break
  fi
  sleep 2
done
if [ "$ready" != 1 ]; then
  echo "restore postgres did not become healthy" >&2
  exit 1
fi

port_line=$($COMPOSE port postgres 5432 || true)
case "$port_line" in
  *5435*|*55435*|*6380*|*56380*) echo "refusing published database port $port_line" >&2; exit 1 ;;
esac

echo "restoring database into ${PROJECT}"
docker cp "$BACKUP_DIR/database.dump" nexa-restore-check-postgres:/tmp/database.dump
set +e
docker exec nexa-restore-check-postgres pg_restore \
  --no-owner \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  /tmp/database.dump
restore_status=$?
set -e
if [ "$restore_status" -gt 1 ]; then
  echo "pg_restore failed with status ${restore_status}" >&2
  exit "$restore_status"
fi

for volume in document_storage audit_export_storage; do
  archive="$BACKUP_DIR/${volume}.tar.gz"
  if [ ! -f "$archive" ]; then
    echo "missing $archive" >&2
    exit 1
  fi
  target="${PROJECT}_${volume}"
  docker volume create "$target" >/dev/null
  echo "restoring ${target}"
  docker run --rm \
    -v "${target}:/target" \
    -v "$BACKUP_DIR:/backup:ro" \
    alpine:3.20 \
    tar -xzf "/backup/${volume}.tar.gz" -C /target
done

for volume in caddy_data caddy_config; do
  archive="$BACKUP_DIR/${volume}.tar.gz"
  if [ ! -f "$archive" ]; then
    echo "optional ${volume} archive is absent"
    continue
  fi
  target="${PROJECT}_${volume}"
  docker volume create "$target" >/dev/null
  echo "restoring ${target}"
  docker run --rm \
    -v "${target}:/target" \
    -v "$BACKUP_DIR:/backup:ro" \
    alpine:3.20 \
    tar -xzf "/backup/${volume}.tar.gz" -C /target
done

echo "checking restored records"
docker exec nexa-restore-check-postgres psql \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -c "SELECT (SELECT count(*) FROM information_schema.schemata WHERE schema_name = 'langgraph') AS langgraph_schema, (SELECT count(*) FROM langgraph.checkpoints) AS checkpoints, (SELECT count(*) FROM documents) AS documents;"
docker run --rm -v "${PROJECT}_document_storage:/source:ro" alpine:3.20 find /source -type f
docker run --rm -v "${PROJECT}_audit_export_storage:/source:ro" alpine:3.20 find /source -type d
echo "restore-check database ready in project ${PROJECT}"
