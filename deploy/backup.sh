#!/bin/sh
# Backup one Compose project: Postgres (every schema, including langgraph),
# document files, audit exports, and Caddy certificate data when that volume
# exists.
#
# Usage:
#   COMPOSE_PROJECT_NAME=nexa-staging-local \
#   COMPOSE_FILE=compose.yaml:compose.prod.yaml:compose.local-staging.yaml \
#   sh deploy/backup.sh
#
# Refuses the development project and the development host port.
# A second run exits while the first still holds backups/.backup.lock.
# BACKUP_REMOTE is reserved for a copy off this host. Until that destination
# and BACKUP_REMOTE_CMD exist, the copy is unverified.

set -eu

PROJECT="${COMPOSE_PROJECT_NAME:-}"
if [ -z "$PROJECT" ]; then
  echo "COMPOSE_PROJECT_NAME is required" >&2
  exit 1
fi
if [ "$PROJECT" = "nexa-ai" ]; then
  echo "refusing to back up through the development project name" >&2
  exit 1
fi

KEEP="${BACKUP_KEEP:-7}"
LOCK="backups/.backup.lock"
STATUS_LOG="backups/backup-status.log"
mkdir -p backups

if [ -d "$LOCK" ]; then
  echo "backup already running" >&2
  printf '%s FAIL backup-already-running\n' "$(date -u +%Y%m%dT%H%M%SZ)" >> "$STATUS_LOG"
  exit 1
fi
mkdir "$LOCK"
cleanup() {
  status=$?
  rmdir "$LOCK" 2>/dev/null || true
  if [ "$status" -ne 0 ]; then
    printf '%s FAIL backup-failed\n' "$(date -u +%Y%m%dT%H%M%SZ)" >> "$STATUS_LOG"
  fi
}
trap cleanup EXIT

COMPOSE="docker compose -p ${PROJECT}"
if [ -n "${COMPOSE_FILE:-}" ]; then
  OLD_IFS=$IFS
  IFS=:
  for file in $COMPOSE_FILE; do
    COMPOSE="$COMPOSE -f $file"
  done
  IFS=$OLD_IFS
fi

PORT_LINE="$($COMPOSE port postgres 5432 || true)"
case "$PORT_LINE" in
  *:5435) echo "refusing the development Postgres port" >&2; exit 1 ;;
esac

if [ -z "${POSTGRES_USER:-}" ]; then
  POSTGRES_USER="$($COMPOSE exec -T postgres printenv POSTGRES_USER)"
fi
if [ -z "${POSTGRES_DB:-}" ]; then
  POSTGRES_DB="$($COMPOSE exec -T postgres printenv POSTGRES_DB)"
fi
case "$POSTGRES_DB" in
  nexa_ai) echo "refusing the development database name" >&2; exit 1 ;;
esac

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="backups/${PROJECT}-${STAMP}"
mkdir -p "$DEST"
chmod 700 "$DEST" 2>/dev/null || true

echo "writing database dump"
$COMPOSE exec -T postgres pg_dump \
  --format=custom \
  --no-owner \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  > "$DEST/database.dump"

echo "checking langgraph schema is present in the dump"
docker run --rm -v "$PWD/$DEST:/backup" postgres:17 \
  pg_restore --list /backup/database.dump > "$DEST/restore.list"
grep -q "SCHEMA - langgraph" "$DEST/restore.list"
rm -f "$DEST/restore.list"

archive_volume() {
  volume="$1"
  docker volume inspect "${PROJECT}_${volume}" >/dev/null 2>&1 || {
    echo "volume ${volume} is absent"
    return 0
  }
  echo "archiving ${volume}"
  docker run --rm \
    -v "${PROJECT}_${volume}:/source:ro" \
    -v "$PWD/$DEST:/backup" \
    alpine:3.20 \
    tar -czf "/backup/${volume}.tar.gz" -C /source .
}

archive_volume document_storage
archive_volume audit_export_storage
archive_volume caddy_data
archive_volume caddy_config

chmod 600 "$DEST"/* 2>/dev/null || true
# Windows chmod does not change NTFS access. Restrict the directory to the
# current user when icacls is available. On Linux, the chmod above is the control.
if command -v icacls >/dev/null 2>&1; then
  owner="${USERNAME:-}"
  if [ -n "$owner" ]; then
    icacls "$DEST" /inheritance:r /grant:r "${owner}:(OI)(CI)(F)" >/dev/null || true
    for restricted in "$DEST"/*; do
      icacls "$restricted" /inheritance:r /grant:r "${owner}:(F)" >/dev/null || true
    done
    icacls "$STATUS_LOG" /inheritance:r /grant:r "${owner}:F" >/dev/null || true
  fi
fi
{
  echo "project ${PROJECT}"
  echo "created ${STAMP}"
  find "$DEST" -type f -exec basename {} \;
} > "$DEST/manifest.txt"
chmod 600 "$DEST/manifest.txt" 2>/dev/null || true

set -- backups/${PROJECT}-*
if [ -d "$1" ]; then
  count=$#
  remove=$((count - KEEP))
  for dir in "$@"; do
    if [ "$remove" -le 0 ]; then
      break
    fi
    if [ "$dir" = "$DEST" ]; then
      continue
    fi
    rm -rf "$dir"
    echo "retained-removal ${dir#backups/}"
    remove=$((remove - 1))
  done
fi

if [ -n "${BACKUP_REMOTE:-}" ]; then
  if [ -z "${BACKUP_REMOTE_CMD:-}" ]; then
    echo "off-server-backup=unverified" >&2
    exit 1
  fi
  # The command receives the backup directory and must not print its contents.
  $BACKUP_REMOTE_CMD "$DEST"
  echo "off-server-backup=command-finished"
else
  echo "off-server-backup=unverified"
fi

printf '%s OK %s\n' "$(date -u +%Y%m%dT%H%M%SZ)" "$DEST" >> "$STATUS_LOG"
echo "backup written to $DEST"
