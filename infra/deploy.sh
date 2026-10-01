#!/usr/bin/env bash
# Deploy / refresh the Jawdi production stack on the VPS.
#   Usage:  ./deploy.sh [IMAGE_TAG]
#   IMAGE_TAG (optional) overrides the tag of BACKEND_IMAGE / WEB_IMAGE /
#   LANDING_IMAGE (e.g. a commit SHA passed by CI). Without it, .env tags are used.
#
# After `up -d` the script waits for the backend's Docker HEALTHCHECK to turn healthy. If it never
# does, it redeploys the last tag that WAS healthy (recorded in infra/.last-good-tag) and exits 1,
# so the CI job fails instead of reporting a green deploy of a crash-looping backend.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.prod.yml"
LAST_GOOD_FILE=".last-good-tag"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

[ -f .env ] || { echo "ERROR: missing infra/.env (copy from .env.prod.example)"; exit 1; }
[ -f secrets/jwt_private.pem ] || { echo "ERROR: missing infra/secrets/jwt_private.pem"; exit 1; }
[ -f secrets/jwt_public.pem ]  || { echo "ERROR: missing infra/secrets/jwt_public.pem"; exit 1; }

# Load .env then inject the multiline PEM keys (compose interpolates $JWT_*_KEY).
set -a
# shellcheck disable=SC1091
source .env
set +a
export JWT_PRIVATE_KEY="$(cat secrets/jwt_private.pem)"
export JWT_PUBLIC_KEY="$(cat secrets/jwt_public.pem)"

# Point the three images at one tag. An empty tag leaves the .env tags in force.
use_tag() {
  if [ "${1:-}" != "" ]; then
    export BACKEND_IMAGE="${BACKEND_IMAGE%:*}:$1"
    export WEB_IMAGE="${WEB_IMAGE%:*}:$1"
    export LANDING_IMAGE="${LANDING_IMAGE%:*}:$1"
  fi
}

# `up -d` returns as soon as the containers are created, not when the app is up. The backend image
# carries a HEALTHCHECK (curl /actuator/health, status UP), so ask Docker for its verdict.
wait_backend_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) cid status
  while [ "$SECONDS" -lt "$deadline" ]; do
    cid="$($COMPOSE ps -q backend 2>/dev/null || true)"
    if [ -n "$cid" ]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo unknown)"
      [ "$status" = "healthy" ] && return 0
      echo "  backend health: $status"
    fi
    sleep 5
  done
  return 1
}

# Optional image-tag override (CI passes the commit SHA for immutable deploys).
NEW_TAG="${1:-}"
use_tag "$NEW_TAG"

echo "Deploying backend=$BACKEND_IMAGE  web=$WEB_IMAGE  landing=$LANDING_IMAGE"
$COMPOSE pull
$COMPOSE up -d --remove-orphans

echo "Waiting for the backend to become healthy (max ${HEALTH_TIMEOUT}s)…"
if ! wait_backend_healthy; then
  echo "ERROR: backend did not become healthy within ${HEALTH_TIMEOUT}s." >&2
  $COMPOSE logs --tail=80 backend >&2 || true
  PREVIOUS_TAG="$(cat "$LAST_GOOD_FILE" 2>/dev/null || true)"
  if [ -n "$PREVIOUS_TAG" ] && [ "$PREVIOUS_TAG" != "$NEW_TAG" ]; then
    echo "Rolling back to the last good tag: $PREVIOUS_TAG" >&2
    use_tag "$PREVIOUS_TAG"
    $COMPOSE up -d --remove-orphans
    if wait_backend_healthy; then
      echo "Rollback to $PREVIOUS_TAG is healthy. The failed deploy (${NEW_TAG:-.env tags}) is NOT live." >&2
    else
      echo "ERROR: rollback to $PREVIOUS_TAG is not healthy either — manual intervention needed." >&2
    fi
  else
    echo "No different previous good tag recorded: nothing to roll back to." >&2
  fi
  echo "NOTE: Flyway migrations only move forward; a rollback restores the old code, not the old schema." >&2
  exit 1
fi
if [ -n "$NEW_TAG" ]; then
  echo "$NEW_TAG" > "$LAST_GOOD_FILE"
fi

# The Caddyfile is a bind mount of a single FILE, and Docker resolves that mount to an inode when
# the container is created. `git pull` does not edit in place — it writes a new file and renames it
# over the old one — so the running container stays bound to the OLD inode and keeps reading the
# previous content forever. `caddy reload` then re-reads that stale file and reports
# "config is unchanged"; `restart` reuses the same container, hence the same inode, and is no
# better. Only recreating the container re-resolves the mount.
echo "Recreating Caddy so it picks up the current Caddyfile…"
$COMPOSE up -d --force-recreate caddy

docker image prune -f >/dev/null || true
$COMPOSE ps
echo "Done. Follow logs with: $COMPOSE logs -f backend"
