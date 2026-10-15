#!/usr/bin/env bash

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "Backup directory does not exist."
  exit 0
fi

find "$BACKUP_DIR" \
  -type f \
  -name "nexa_ai_*.dump" \
  -mtime +14 \
  -delete

echo "Old local backups cleaned."
