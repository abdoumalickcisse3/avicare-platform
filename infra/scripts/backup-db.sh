#!/usr/bin/env bash
# Nightly PostgreSQL backup -> gzip -> (optional) offsite via rclone.
# Cron example (daily 02:30):
#   30 2 * * * /opt/avicare-platform/infra/scripts/backup-db.sh >> /home/deploy/avicare-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."   # -> infra/

COMPOSE="docker compose -f docker-compose.prod.yml"

[ -f .env ] || { echo "ERROR: missing infra/.env"; exit 1; }
set -a
# shellcheck disable=SC1091
source .env
set +a
# The compose file references the JWT PEM keys (${JWT_*_KEY:?}); export them so
# `docker compose` can interpolate the whole file (same as deploy.sh). Backups
# only touch postgres, but compose still parses every service definition.
if [ -f secrets/jwt_private.pem ]; then export JWT_PRIVATE_KEY; JWT_PRIVATE_KEY="$(cat secrets/jwt_private.pem)"; fi
if [ -f secrets/jwt_public.pem ]; then export JWT_PUBLIC_KEY; JWT_PUBLIC_KEY="$(cat secrets/jwt_public.pem)"; fi

# Persistent local dir (NOT /tmp, which is cleared on reboot). Owned by the deploy user.
BACKUP_DIR="${BACKUP_DIR:-$HOME/avicare-backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F_%H%M%S)"
OUT="$BACKUP_DIR/avicare_${DB_NAME:-avicare}_${STAMP}.sql.gz"

$COMPOSE exec -T postgres \
  pg_dump -U "${DB_USER:-avicare}" "${DB_NAME:-avicare}" | gzip > "$OUT"
echo "Local dump: $OUT ($(du -h "$OUT" | cut -f1))"

# Offsite copy (configure an rclone remote: Backblaze B2 / S3 / Contabo Object Storage).
if [ -n "${BACKUP_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  rclone copy "$OUT" "$BACKUP_REMOTE" && echo "Uploaded to $BACKUP_REMOTE"
else
  echo "NOTE: no offsite upload (set BACKUP_REMOTE in .env + install/configure rclone)"
fi

# Retain local copies for 14 days.
find "$BACKUP_DIR" -maxdepth 1 -name "avicare_*.sql.gz" -mtime +14 -delete
