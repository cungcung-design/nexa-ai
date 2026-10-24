# Restore

Backups are created by `deploy/backup.sh`. A dump includes every schema in the target database, and the script rejects a dump that does not list `langgraph`. Document files and audit exports are separate archives because they are not inside Postgres.

`deploy/restore.sh` does not restore a database. It refuses the development project name `nexa-ai` and host port 5435. A live restore is a manual procedure in `deploy/STAGING_VPS.md`. Run it only against the intended staging or production project, with the API and worker stopped, and only after `pg_restore --list` shows the `langgraph` schema.

`deploy/restore-disposable.sh` is the restore drill. It writes only to project `nexa-restore-check`, and it refuses the development database name, the active local staging database name, and their database users. Remove that project with `docker compose -p nexa-restore-check -f compose.restore-check.yaml down -v` after reading the result.

Do not use `--clean` against the local development database or the active `nexa-staging-local` database.

`deploy/backup.sh` also keeps seven backups, locks against an overlapping run, and can archive Caddy volumes. `deploy/check_operations.py` reads health, failed-job counts, disk space, and backup age. An off-server copy stays unverified until `BACKUP_REMOTE_CMD` is configured.

The 23 October 2026 drill of `nexa-staging-local-20261023T120807Z` into `nexa-restore-check` finished in 15.02 seconds. It restored the `langgraph` schema, 2 checkpoints, 1 document, and that document's stored file. The disposable project was then removed with `down -v`.
