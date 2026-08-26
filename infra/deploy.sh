#!/usr/bin/env bash
# Deploy / refresh the Jawdi production stack on the VPS.
#   Usage:  ./deploy.sh [IMAGE_TAG]
#   IMAGE_TAG (optional) overrides the tag of BACKEND_IMAGE / WEB_IMAGE /
#   LANDING_IMAGE (e.g. a commit SHA passed by CI). Without it, .env tags are used.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.prod.yml"

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

# Optional image-tag override (CI passes the commit SHA for immutable deploys).
if [ "${1:-}" != "" ]; then
  export BACKEND_IMAGE="${BACKEND_IMAGE%:*}:$1"
  export WEB_IMAGE="${WEB_IMAGE%:*}:$1"
  export LANDING_IMAGE="${LANDING_IMAGE%:*}:$1"
fi

echo "Deploying backend=$BACKEND_IMAGE  web=$WEB_IMAGE  landing=$LANDING_IMAGE"
$COMPOSE pull
$COMPOSE up -d --remove-orphans

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
