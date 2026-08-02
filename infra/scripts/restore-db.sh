#!/usr/bin/env bash
# Restore a gzipped pg_dump into the running postgres container.
# Usage: ./scripts/restore-db.sh /home/deploy/avicare-backups/avicare_avicare_2026-08-02_023000.sql.gz
# WARNING: overwrites the current database contents. Take a fresh backup first.
set -euo pipefail
cd "$(dirname "$0")/.."   # -> infra/

DUMP="${1:?Usage: restore-db.sh <path-to-dump.sql.gz>}"
[ -f "$DUMP" ] || { echo "ERROR: file not found: $DUMP"; exit 1; }

COMPOSE="docker compose -f docker-compose.prod.yml"
[ -f .env ] || { echo "ERROR: missing infra/.env"; exit 1; }
set -a
# shellcheck disable=SC1091
source .env
set +a
if [ -f secrets/jwt_private.pem ]; then export JWT_PRIVATE_KEY; JWT_PRIVATE_KEY="$(cat secrets/jwt_private.pem)"; fi
if [ -f secrets/jwt_public.pem ]; then export JWT_PUBLIC_KEY; JWT_PUBLIC_KEY="$(cat secrets/jwt_public.pem)"; fi

echo "About to restore '$DUMP' into database '${DB_NAME:-avicare}'. This overwrites current data."
read -r -p "Type 'yes' to continue: " CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Aborted."; exit 1; }

gunzip -c "$DUMP" | $COMPOSE exec -T postgres psql -U "${DB_USER:-avicare}" "${DB_NAME:-avicare}"
echo "Restore complete."
