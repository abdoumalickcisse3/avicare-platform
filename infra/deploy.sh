#!/usr/bin/env bash
# Deploy / refresh the Jawdi production stack on the VPS.
#   Usage:  ./deploy.sh [IMAGE_TAG]
#   IMAGE_TAG (optional) overrides the tag of BACKEND_IMAGE / WEB_IMAGE
#   (e.g. a commit SHA passed by CI). Without it, the tags from .env are used.
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
fi

echo "Deploying backend=$BACKEND_IMAGE  web=$WEB_IMAGE"
$COMPOSE pull
$COMPOSE up -d --remove-orphans
docker image prune -f >/dev/null || true
$COMPOSE ps
echo "Done. Follow logs with: $COMPOSE logs -f backend"
