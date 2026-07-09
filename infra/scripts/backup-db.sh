#!/usr/bin/env bash
# Nightly PostgreSQL backup -> gzip -> (optional) offsite via rclone.
# Cron example (daily 02:30):
#   30 2 * * * /opt/avicare-platform/infra/scripts/backup-db.sh >> /var/log/avicare-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."   # -> infra/

COMPOSE="docker compose -f docker-compose.prod.yml"
set -a
# shellcheck disable=SC1091
source .env
set +a

STAMP="$(date +%F_%H%M%S)"
OUT="/tmp/avicare_${DB_NAME:-avicare}_${STAMP}.sql.gz"

$COMPOSE exec -T postgres \
  pg_dump -U "${DB_USER:-avicare}" "${DB_NAME:-avicare}" | gzip > "$OUT"
echo "Local dump: $OUT ($(du -h "$OUT" | cut -f1))"

# Offsite copy (configure an rclone remote: Backblaze B2 / S3 / Hetzner Storage Box).
if [ -n "${BACKUP_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  rclone copy "$OUT" "$BACKUP_REMOTE" && echo "Uploaded to $BACKUP_REMOTE"
else
  echo "WARNING: no offsite upload (set BACKUP_REMOTE in .env and install rclone)"
fi

# Retain local copies for 7 days.
find /tmp -maxdepth 1 -name "avicare_*.sql.gz" -mtime +7 -delete
