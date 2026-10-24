#!/bin/sh
# Deploy one exact commit on the staging VPS.
# The caller passes GIT_SHA and, when pulling, an immutable IMAGE_TAG.
# This script does not print the environment file or registry credentials.

set -eu

DEPLOY_DIR="${DEPLOY_DIR:-/opt/nexa}"
GIT_SHA="${GIT_SHA:?GIT_SHA is required}"
IMAGE_TAG="${IMAGE_TAG:-}"
REGISTRY="${REGISTRY:?REGISTRY is required}"
GHCR_USER="${GHCR_USER:-}"
if [ -n "${GHCR_PULL_TOKEN_B64:-}" ]; then
  GHCR_PULL_TOKEN="$(printf '%s' "$GHCR_PULL_TOKEN_B64" | base64 -d)"
  unset GHCR_PULL_TOKEN_B64
else
  GHCR_PULL_TOKEN="${GHCR_PULL_TOKEN:-}"
fi

case "$GIT_SHA" in
  *[!0-9a-f]*)
    echo "GIT_SHA must be a lowercase hex commit"
    exit 1
    ;;
esac
if [ "${#GIT_SHA}" -ne 40 ]; then
  echo "GIT_SHA must be 40 hex characters"
  exit 1
fi

if [ -n "$IMAGE_TAG" ]; then
  case "$IMAGE_TAG" in
    latest|main|master|compose|previous)
      echo "floating image tags are not deployable"
      exit 1
      ;;
  esac
  short="$(printf '%s' "$GIT_SHA" | cut -c1-12)"
  if [ "$IMAGE_TAG" != "$GIT_SHA" ] && [ "$IMAGE_TAG" != "sha-$short" ]; then
    echo "image tag must be the commit SHA or sha- followed by its first 12 hex characters"
    exit 1
  fi
  if [ -z "$GHCR_PULL_TOKEN" ] || [ -z "$GHCR_USER" ]; then
    echo "GHCR_PULL_TOKEN and GHCR_USER are required to pull an image tag"
    exit 1
  fi
fi

cd "$DEPLOY_DIR"
git fetch --no-tags origin "$GIT_SHA"
git checkout --detach "$GIT_SHA"
head_sha="$(git rev-parse HEAD)"
if [ "$head_sha" != "$GIT_SHA" ]; then
  echo "checkout did not match the requested commit"
  exit 1
fi

python3 deploy/check_vps_env.py .env.production vps

set -a
# shellcheck disable=SC1091
. ./.env.production
set +a

export COMPOSE_PROJECT_NAME=nexa-staging
export COMPOSE_FILE=compose.yaml:compose.prod.yaml

echo "backing up before migrations"
backup_output="$(sh deploy/backup.sh)"
printf '%s\n' "$backup_output"
dest="$(printf '%s\n' "$backup_output" | tail -n 1 | sed 's/^backup written to //')"
mkdir -p "$dest"
{
  echo "commit $GIT_SHA"
  docker inspect --format '{{.Name}} {{.Config.Image}}' nexa-api nexa-worker nexa-web 2>/dev/null || true
} > "$dest/previous-images.txt"

tag="$GIT_SHA"
if [ -n "$IMAGE_TAG" ]; then
  tag="$IMAGE_TAG"
  printf '%s' "$GHCR_PULL_TOKEN" | docker login ghcr.io --username "$GHCR_USER" --password-stdin >/dev/null
  docker pull "$REGISTRY/nexa-api:$tag"
  docker pull "$REGISTRY/nexa-worker:$tag"
  docker pull "$REGISTRY/nexa-web:$tag"
else
  docker compose --env-file .env.production -p nexa-staging \
    -f compose.yaml -f compose.prod.yaml build
  short="$(printf '%s' "$GIT_SHA" | cut -c1-12)"
  docker tag nexa-api:compose "$REGISTRY/nexa-api:$GIT_SHA"
  docker tag nexa-worker:compose "$REGISTRY/nexa-worker:$GIT_SHA"
  docker tag nexa-web:compose "$REGISTRY/nexa-web:$GIT_SHA"
  docker tag nexa-api:compose "$REGISTRY/nexa-api:sha-$short"
  docker tag nexa-worker:compose "$REGISTRY/nexa-worker:sha-$short"
  docker tag nexa-web:compose "$REGISTRY/nexa-web:sha-$short"
fi

export NEXA_API_IMAGE="$REGISTRY/nexa-api:$tag"
export NEXA_WORKER_IMAGE="$REGISTRY/nexa-worker:$tag"
export NEXA_WEB_IMAGE="$REGISTRY/nexa-web:$tag"

echo "running migrations for $GIT_SHA"
docker compose --env-file .env.production -p nexa-staging \
  -f compose.yaml -f compose.prod.yaml \
  up -d --wait --wait-timeout 120 postgres redis
if ! docker compose --env-file .env.production -p nexa-staging \
  -f compose.yaml -f compose.prod.yaml \
  run --rm --no-deps migrate; then
  echo "migration failed; application containers were not replaced"
  exit 1
fi

docker compose --env-file .env.production -p nexa-staging \
  -f compose.yaml -f compose.prod.yaml \
  up -d --no-build

attempt=0
api_health="missing"
web_health="missing"
while [ "$attempt" -lt 36 ]; do
  api_health="$(docker inspect --format '{{.State.Health.Status}}' nexa-api 2>/dev/null || echo missing)"
  web_health="$(docker inspect --format '{{.State.Health.Status}}' nexa-web 2>/dev/null || echo missing)"
  if [ "$api_health" = "healthy" ] && [ "$web_health" = "healthy" ]; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 5
done
echo "api-health=$api_health"
echo "web-health=$web_health"
if [ "$api_health" != "healthy" ] || [ "$web_health" != "healthy" ]; then
  echo "container health checks failed"
  exit 1
fi

api_code="$(curl -sS -o /dev/null -w '%{http_code}' "https://${API_DOMAIN}/ready" || true)"
web_code="$(curl -sS -o /dev/null -w '%{http_code}' "https://${APP_DOMAIN}/" || true)"
echo "api-ready=$api_code"
echo "web=$web_code"
if [ "$api_code" != "200" ] || [ "$web_code" != "200" ]; then
  echo "public health checks failed"
  exit 1
fi

echo "staging-deploy-ok commit=$GIT_SHA"
