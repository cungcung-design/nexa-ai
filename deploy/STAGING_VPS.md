# NEXORA staging VPS runbook

This prepares a staging host. It does not purchase a server, create DNS records, or start public traffic.

Use `compose.yaml` and `compose.prod.yaml` together. Do not add `compose.local-staging.yaml` on the VPS. Always pass `-p nexa-staging`. The base file names the development project `nexa-ai`, and the local staging project is `nexa-staging-local`.

## 1. VPS size and operating system

Use Ubuntu 24.04 LTS on an x86_64 VPS with at least 4 vCPU, 8 GB RAM, and 80 GB SSD. The worker loads a local embedding model, so 8 vCPU and 16 GB RAM is the safer staging size.

Hetzner list prices checked on 23 October 2026, excluding VAT:

| Plan | Size | Monthly price with primary IPv4 | Stock note |
|---|---|---|---|
| CX33 | 4 vCPU, 8 GB, 80 GB | about $10.59 | Shared CX line was reported sold out |
| CX43 | 8 vCPU, 16 GB, 160 GB | about $19.09 | Shared CX line was reported sold out |
| CPX32 | 4 vCPU, 8 GB, 160 GB | about $42.59 | In-stock alternative if CX33 is unavailable |
| CPX42 | 8 vCPU, 16 GB, 320 GB | about $82.59 | In-stock alternative if CX43 is unavailable |

Hetzner's own cloud page the same day showed the shared line as currently unavailable and listed cost-optimized plans from €5.99 per month excluding VAT. Confirm the live price, VAT, and stock in the provider console before buying. EU locations include a large traffic allowance. A primary IPv4 address is about €0.50 per month before VAT when it is billed separately.

Add provider backups at about 20 percent of the server price, plus a domain name. Chat inference is a separate monthly cost because the VPS does not host the chat model. SMTP and Stripe test mode are blocked until real test credentials exist. Stripe test mode itself has no processing fee.

## 2. Docker installation

Install Docker Engine and the Compose plugin from Docker's Ubuntu repository. The local validation daemon was Docker 29.8.1. Confirm `docker compose version` after installation. Add the deploy user to the `docker` group, then open a new login so the group applies.

## 3. DNS

Create two A records pointing at the VPS IPv4 address:

- `APP_DOMAIN`, for example `staging.example.com`
- `API_DOMAIN`, for example `api.staging.example.com`

Use bare hostnames. Do not put a scheme or a port in either value. Leave time for public resolvers to see both records before the first Caddy start. Caddy requests the certificates and will fail if port 80 cannot reach the host or the names do not point here.

## 4. Firewall and SSH

Hetzner Cloud Firewall, or the equivalent at another provider, is the boundary that Docker cannot bypass. Allow inbound traffic only for:

- `22/tcp` from the operator's IP address
- `80/tcp` from the public internet, for certificate issuance and HTTP redirect
- `443/tcp` and `443/udp` from the public internet

Do not allow `5432`, `5435`, `6379`, `6380`, `8000`, or `3000`. PostgreSQL and Redis publish no host ports in the production overlay. The API and web containers are reached only through Caddy on the Docker network.

On the guest, `ufw` can allow OpenSSH, 80, and 443 as a second layer. Docker can publish a port around `ufw`, so the cloud firewall remains required. The production Compose file publishes only Caddy's ports.

SSH requirements:

- An ed25519 key owned by the operator
- `PasswordAuthentication no`
- `PermitRootLogin no`
- A deploy user that can run Docker
- No private keys, `.env.production`, or database dumps committed to git

## 5. Environment file

Create `/opt/nexa/.env.production` on the server from `.env.example`. Keep it outside git and readable only by the deploy user.

Generate a new `JWT_SECRET` of at least 32 characters. Do not reuse the value in `apps/api/.env`. `deploy/check_vps_env.py` compares the two files without printing either value.

`POSTGRES_PASSWORD` must be letters and digits. Compose inserts it into `DATABASE_URL` without encoding.

`NEXA_API_URL` stays `http://api:8000`. `FRONTEND_URL` is `https://APP_DOMAIN`. `NEXT_PUBLIC_API_URL` is `https://API_DOMAIN` and is baked into the web image at build time, so changing the API domain requires a web rebuild.

`LLM_BASE_URL` must be an `https://` endpoint the VPS can open. `host.docker.internal`, `localhost`, and `127.0.0.1` are the developer machine. The production overlay rejects a missing inference URL or key. Confirm reachability from the VPS before starting the stack:

```sh
curl -sS -o /dev/null -w "%{http_code}\n" "$LLM_BASE_URL/models"
```

A placeholder SMTP host such as `smtp.invalid` does not send mail. Production boot only checks that `SMTP_HOST` and `SMTP_FROM_EMAIL` are non-empty. A placeholder is not treated as a working server, so password reset keeps its generic response and does not reveal a link. Leave real SMTP unset until a mailbox exists.

Use one TLS mode. `SMTP_USE_STARTTLS=true` with `SMTP_PORT=587` upgrades the connection. `SMTP_USE_SSL=true` with `SMTP_USE_STARTTLS=false` and `SMTP_PORT=465` uses implicit TLS. Enabling both stops production boot. Password-reset links are built from `FRONTEND_URL`. The mailer does not log the SMTP password or the reset token.

Stripe stays empty until test-mode values exist. A staging secret must start with `sk_test_`. An `sk_live_` secret is rejected by production boot and by `deploy/check_vps_env.py`. The webhook secret must start with `whsec_`. Each configured price id must match `price_` followed by letters, digits, or underscores, and must not contain `REPLACE`. The webhook reads the raw request body, checks the signature, ignores a repeated event id, and refuses an event whose `livemode` is true. Workspace plan changes that grant access still come from those verified events. Checkout, the portal, cancellation, and payment-method changes require the workspace owner.

Check the file before the first start:

```sh
python deploy/check_vps_env.py .env.production vps
```

## 6. Deployment commands

From the repository directory on the VPS:

```sh
docker compose --env-file .env.production -p nexa-staging \
  -f compose.yaml -f compose.prod.yaml up -d --build
```

The `migrate` service runs `alembic upgrade head` once, holds a Postgres advisory lock, and does not restart. The API and worker wait until that container exits successfully. A failed migration leaves them stopped.

Watch the first boot:

```sh
docker compose --env-file .env.production -p nexa-staging \
  -f compose.yaml -f compose.prod.yaml ps
docker compose --env-file .env.production -p nexa-staging \
  -f compose.yaml -f compose.prod.yaml logs migrate
```

## 7. Database migrations

The only migration command is `alembic upgrade head`, through `python scripts/migrate.py`. It refuses to start when another migration holds the advisory lock. Do not run a second migrate by hand while the service is running.

Do not run `alembic downgrade`. The LangGraph revision's downgrade drops schema `langgraph` with `CASCADE`.

Existing databases are migrated forward. The deployment does not drop or recreate volumes.

## 8. Health checks

- Postgres: `pg_isready` for the configured user and database
- Redis: `redis-cli ping`
- API: `GET /ready` from inside the container, which checks Postgres
- Worker: `celery inspect ping`
- Web: HTTP request to `http://127.0.0.1:3000/`
- Caddy starts after the web and API checks are healthy

From outside the host, after DNS and certificates exist:

```sh
curl -fsS "https://${API_DOMAIN}/ready"
curl -fsS -o /dev/null -w "%{http_code}\n" "https://${APP_DOMAIN}/"
```

`/health` is liveness only. `/ready` is the dependency check.

## 9. Backup and restore

Daily backup, from a checkout that has the Compose files and the env file:

```sh
COMPOSE_PROJECT_NAME=nexa-staging \
COMPOSE_FILE=compose.yaml:compose.prod.yaml \
sh deploy/backup.sh
```

The dump must list schema `langgraph`. Document files, audit exports, and Caddy certificate volumes are separate archives when those volumes exist. The script keeps the newest 7 backups for that project, creates the directory with mode `0700`, and refuses to start while `backups/.backup.lock` exists. On Linux the files are mode `0600`. A Windows host does not apply those Unix modes, so the script also removes inherited NTFS access and grants the current user full control. A failed run appends `FAIL` to `backups/backup-status.log` and does not print the database URL.

`BACKUP_REMOTE` names an off-server destination. The copy runs only when `BACKUP_REMOTE_CMD` is also set. With neither value, the script prints `off-server-backup=unverified`. A backup that stays on the same host does not survive host loss. No remote destination is configured, so that copy is not verified.

Schedule the backup and the operations check on the VPS. This repository does not install the schedule.

```cron
15 3 * * * cd /opt/nexa && COMPOSE_PROJECT_NAME=nexa-staging COMPOSE_FILE=compose.yaml:compose.prod.yaml sh deploy/backup.sh
25 3 * * * cd /opt/nexa && python deploy/check_operations.py --api-container nexa-api --web-container nexa-web --worker-container nexa-worker --redis-container nexa-redis --project nexa-staging --backup-dir backups
```

The container names follow Compose. Confirm them with `docker ps` before installing the schedule. Mail the cron output to an operator address with `MAILTO` if the host already has a mailer. That delivery is not configured here, so no external alert has been sent.

`deploy/check_operations.py` reports API readiness, web availability, and worker health from the container health checks. It sums `nexa:monitor:failed-jobs` in Redis. That hash stores task names and counts, not arguments or document text. It also reports free disk percent and the age of the newest dump. The default limits are 26 hours and 10 percent free. A failing check exits 1.

A restore drill uses a different project and an empty database. It refuses `nexa-ai`, `nexa-staging-local`, the development database name, and the development database user:

```sh
BACKUP_DIR=backups/<stamp> sh deploy/restore-disposable.sh
```

That command writes only to project `nexa-restore-check`. Remove the drill when it has been read:

```sh
docker compose --env-file .env.restore-check -p nexa-restore-check \
  -f compose.restore-check.yaml down -v
docker volume rm nexa-restore-check_document_storage nexa-restore-check_audit_export_storage
```

`down -v` removes the Postgres volume. The document and audit volumes are created beside that service, so remove those two names as well. Do not remove `nexa-ai_*` or `nexa-staging-local_*`.

`deploy/restore.sh` still does not execute a restore. A restore onto the live staging database is manual and only after a fresh backup:

1. Confirm `docker compose -p nexa-staging port postgres 5432` prints no host port, and that the project is not `nexa-ai`.
2. Stop `api`, `worker`, and `web`.
3. `pg_restore --clean --if-exists --no-owner` into that project's Postgres only. `--clean` drops objects that are in the dump before recreating them.
4. Extract `document_storage.tar.gz` and `audit_export_storage.tar.gz` into `nexa-staging_document_storage` and `nexa-staging_audit_export_storage`.
5. Start the stack and request `/ready`.

Never point `--clean` at the development database or at `nexa-staging-local`.

## 10. Rollback

Before each release, run a backup and tag the running images:

```sh
docker tag nexa-api:compose nexa-api:previous
docker tag nexa-worker:compose nexa-worker:previous
docker tag nexa-web:compose nexa-web:previous
```

If the new containers fail before `migrate` exits successfully, retag the previous images back to `:compose` and start the stack again. The database is unchanged.

If `migrate` exited successfully and the release is still bad, restore the backup taken before that migration, then start the previous images. Do not roll the schema back with Alembic.

Alembic applies one revision at a time inside a PostgreSQL transaction. A migration that fails rolls that revision back, and the deployment script does not replace the API, worker, or web containers. The database stays on the previous revision. Start Postgres and Redis again if they were stopped, then redeploy the previous commit.

A migration that exits successfully is not reversible from this repository. The LangGraph revision's downgrade drops schema `langgraph` with `CASCADE`, so `alembic downgrade` is not a recovery path. Restore the backup written at the start of that deployment, then deploy the previous commit or its immutable image tag. The backup directory records that commit and the image names that were running before the replacement.

A changed `API_DOMAIN` or `NEXT_PUBLIC_API_URL` needs a new web image build. The browser bundle keeps the value from the build that produced it. An image tagged `latest`, `main`, `master`, `compose`, or `previous` is not a deployment target.

## 11. Security controls

The production overlay drops all Linux capabilities and sets `no-new-privileges` on Caddy, the migration, the API, the worker, and the web server. Postgres and Redis already had `no-new-privileges`. Only Caddy publishes ports: `80/tcp`, `443/tcp`, and `443/udp`. Postgres, Redis, the API, and the web server publish none.

`TRUSTED_HOSTS` comes from `API_DOMAIN`. The API also accepts `localhost`, `127.0.0.1`, and the Docker name `api` so the health check and the web server can call it. A wildcard host or CORS origin is rejected. Credentialed CORS allows only `FRONTEND_URL`.

`TRUST_PROXY=true` is set on the VPS API because Caddy is the only process that can reach it. The local HTTP check sets `TRUST_PROXY=false` and `COOKIE_SECURE=false`, since that API port is published on loopback and the site is not HTTPS. The VPS web image sets `COOKIE_SECURE=true`.

Production boot requires `APP_ENV=production`, a unique `JWT_SECRET` of at least 32 characters, and an explicit `FRONTEND_URL`. A Stripe secret, when present, must be an `sk_test_` key. `sk_live_` stops the process.

Login is limited to 10 attempts per email and 60 per caller address each 15 minutes. Password reset keeps its per-account limit and adds 30 requests per caller address each hour. Agent chat, conversation chat, and public chat are limited to 20 calls per minute. If Redis is unavailable those limits fail closed.

Uploaded files are stored under a generated name. The displayed filename cannot contain a path or control characters. Documents are read and deleted only inside the caller's organization. Public chat errors do not return the internal exception text.

`deploy/check_vps_env.py` still accepts the local staging file, including its HTTP URLs and local inference address, and rejects that file for a VPS.

## 12. SMTP and Stripe verification

Automated tests cover TLS selection, reset-link construction, generic reset responses, test-key rejection, price-id shape, webhook signatures, and duplicate events. Those tests do not contact a mail provider or Stripe.

Provider verification is still blocked. It needs all of the following, placed only in the untracked env file:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, and `SMTP_PASSWORD` for a mailbox that can send to an address you control.
- `SMTP_FROM_EMAIL` on that same domain, with exactly one of `SMTP_USE_STARTTLS` or `SMTP_USE_SSL`.
- `FRONTEND_URL` set to the staging site, so the reset link in the received message opens that site.
- `STRIPE_SECRET_KEY` beginning with `sk_test_`. Do not use `sk_live_`.
- `STRIPE_WEBHOOK_SECRET` beginning with `whsec_`, from a Stripe CLI forwarder or a test-mode webhook endpoint aimed at `https://<API_DOMAIN>/api/v1/billing/webhook`.
- Test-mode price ids for `STRIPE_STARTER_PRICE_ID`, `STRIPE_STARTER_YEARLY_PRICE_ID`, `STRIPE_PRO_PRICE_ID`, and `STRIPE_PRO_YEARLY_PRICE_ID`.

After those values exist, send one password reset and confirm the message arrives with a `FRONTEND_URL` link, then complete one test-mode checkout and confirm the workspace plan changes only after the signed webhook. Do not enable live payments.

## 13. CI and the staging deployment workflow

Pull requests and pushes to `main` or `master` run `.github/workflows/ci.yml`. That workflow tests the API against an ephemeral Postgres database named `nexa_ai_test` and an ephemeral Redis. It also typechecks and unit-tests the web app, builds Next.js, runs Playwright, builds the API, worker, and web images, and renders the production Compose file with dummy values. Those dummy values are not a server environment.

Staging deployment is manual. GitHub Actions, **Deploy staging**, asks for a full commit SHA. Leave the image tag empty to build that commit on the server and tag it `ghcr.io/<owner>/nexa-api:<sha>`, with the same form for `nexa-worker` and `nexa-web`, plus a `sha-` plus the first 12 hex characters tag. Set the image tag only when those three images were already pushed and the tag is the same SHA or its short form. The workflow refuses floating tags. A second staging deployment waits until the first finishes.

The server checkout is `/opt/nexa`. The workflow checks out that SHA, runs `deploy/check_vps_env.py .env.production vps` without printing the file, runs `deploy/backup.sh`, then runs migrations. A failed migration stops the job and leaves the current API, worker, and web containers in place. After a successful migration it starts the stack from the immutable tags and requires the API and web health checks plus `https://<API_DOMAIN>/ready` and `https://<APP_DOMAIN>/` to return 200.

Repository secrets, and not files in git:

| Secret | Purpose |
|---|---|
| `STAGING_SSH_HOST` | VPS address |
| `STAGING_SSH_USER` | Deploy user |
| `STAGING_SSH_KEY` | Private key for that user |
| `STAGING_SSH_KNOWN_HOSTS` | The server's SSH host key line |
| `STAGING_SSH_PORT` | Optional. Defaults to 22 |
| `GHCR_PULL_TOKEN` | `read:packages` token, required only when the image tag input is set |

`/opt/nexa/.env.production` stays on the server. Do not put it in a secret or in git. The registry is `ghcr.io/<repository owner>`, the GitHub Container Registry for this repository. No deployment has been executed, because the VPS and these secrets do not exist yet.

## 14. Monitoring, backup, and recovery

Docker keeps each service log at 10 MB with 5 files. The limit applies after a container is recreated. Local staging was recreated without deleting volumes, and `docker inspect` showed `json-file`, `max-size` 10m, and `max-file` 5 on postgres, redis, api, worker, and web. The local API and worker images were rebuilt from this source and recreated without deleting volumes. Inside those containers, `token=raw-reset-token` and a bearer token were removed by the redaction filter, and the worker source connects the failed-job hook. No failed job has been observed, so the Redis key was absent. API and worker log records pass through that filter before they are written. Password-reset tokens, bearer tokens, Stripe secrets, and webhook secrets are replaced. A failed trace store writes a fixed sentence and does not log the prompt or the exception text. Celery task arguments are document and organization identifiers. Failed jobs increment a Redis counter and do not store the exception.

Recovery after host loss needs the off-server copy. Until `BACKUP_REMOTE` and `BACKUP_REMOTE_CMD` point at a real destination, that copy is unverified. Recovery from a local backup:

1. Stop `api`, `worker`, and `web` for the staging project.
2. Confirm the dump lists schema `langgraph`.
3. Restore only into that project's database. Do not use the development database or `nexa-staging-local` for a drill.
4. Extract `document_storage.tar.gz`, `audit_export_storage.tar.gz`, and the Caddy archives when they are present, into the volumes for that same project.
5. Start the stack and request `/ready`.
6. Do not run `alembic downgrade`.

A disposable drill uses `deploy/restore-disposable.sh` and project `nexa-restore-check`. Remove it with `docker compose -p nexa-restore-check -f compose.restore-check.yaml down -v` after reading the result.

A disposable drill on 23 October 2026 restored `backups/nexa-staging-local-20261023T120807Z` into project `nexa-restore-check`. The command finished in 15.02 seconds. The restored database had the `langgraph` schema, 2 checkpoint rows, and 1 document row. The document storage volume contained the file named by that document. The audit-export volume was present and empty. Caddy archives were absent because this local staging stack does not run Caddy. The restore-check project and its volumes were removed afterward. Development volumes `nexa-ai_*` and staging volumes `nexa-staging-local_*` were not restored over.

## 15. What remains outside this repository

- Buy the VPS and the domain.
- Add the GitHub Actions secrets in section 13. The deployment workflow has not been run.
- Publish the two DNS records.
- Provide an HTTPS inference URL and key that the VPS can reach.
- Provide the SMTP mailbox and Stripe test credentials listed in section 12. Provider verification stays blocked until those values exist.
- Confirm the provider price and available plan on the day of purchase.
- Install the backup and operations-check schedule from section 9, and set `MAILTO` only if the host already has a mailer. Neither the schedule nor an external alert is configured.
- Set `BACKUP_REMOTE` and `BACKUP_REMOTE_CMD` to a real off-server destination. Until then, the off-server copy stays unverified. A backup on the same host does not survive host loss.
