#!/bin/sh
# Restore instructions for a staging or production Compose project.
#
# This script does not restore anything unless RESTORE_I_UNDERSTAND=yes.
# It always refuses the development project, the development container,
# and host port 5435. Do not point it at the existing nexa_ai database.
#
# 1. Stop the API and worker so nothing writes during the restore:
#      docker compose -p <project> stop api worker web
# 2. Confirm the dump lists the langgraph schema:
#      pg_restore --list backups/<stamp>/database.dump | grep langgraph
# 3. Restore the database into the staging database only:
#      cat backups/<stamp>/database.dump | docker compose -p <project> exec -T postgres \
#        pg_restore --clean --if-exists --no-owner --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"
#    --clean drops objects that are in the dump before recreating them.
#    Use it only on the isolated staging or production database.
# 4. Restore files after confirming the volume name belongs to that project:
#      docker run --rm -v <project>_document_storage:/target -v "$PWD/backups/<stamp>:/backup" \
#        alpine:3.20 tar -xzf /backup/document_storage.tar.gz -C /target
#      docker run --rm -v <project>_audit_export_storage:/target -v "$PWD/backups/<stamp>:/backup" \
#        alpine:3.20 tar -xzf /backup/audit_export_storage.tar.gz -C /target
# 5. Start the application again and request /ready.
#
# Set RESTORE_I_UNDERSTAND=yes only after those commands have been reviewed
# for the intended project. This script then prints the exact commands and
# still does not execute them.

set -eu

PROJECT="${COMPOSE_PROJECT_NAME:-}"
if [ -z "$PROJECT" ] || [ "$PROJECT" = "nexa-ai" ]; then
  echo "refusing the development project" >&2
  exit 1
fi
if [ "${RESTORE_I_UNDERSTAND:-}" != "yes" ]; then
  echo "restore was not run; set RESTORE_I_UNDERSTAND=yes to print the commands" >&2
  exit 1
fi

echo "Restore was not executed."
echo "Review deploy/restore.sh and run the printed pg_restore only against ${PROJECT}."
echo "The development database and host port 5435 are out of scope."
