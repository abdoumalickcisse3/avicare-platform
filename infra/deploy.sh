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

# The Caddyfile is a bind mount, so `up -d` sees no change to the caddy service when only its
# CONTENT changed (same image, same volumes, same env) and leaves the container running with the
# config it loaded last time. A new site would answer on :80 but never get a certificate.
# `caddy reload` re-reads the file with zero downtime and re-triggers ACME for the new names.
echo "Reloading Caddy…"
$COMPOSE exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile \
  || $COMPOSE restart caddy

docker image prune -f >/dev/null || true
$COMPOSE ps
echo "Done. Follow logs with: $COMPOSE logs -f backend"
