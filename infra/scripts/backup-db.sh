#!/usr/bin/env bash
# Nightly PostgreSQL backup -> gzip -> (optional) offsite via rclone.
# Cron example (daily 02:30):
#   30 2 * * * /opt/avicare-platform/infra/scripts/backup-db.sh >> /home/deploy/avicare-backup.log 2>&1
#
# A dump only takes its final name once it has been checked: written to <name>.tmp, size above a
# floor, gzip stream intact, pg_dump's closing marker present. A failed or truncated dump therefore
# never sits in the backup directory looking like a good one (the console and the retention below
# both trust that directory). An offsite failure fails the script: a copy that never left the box
# is not a backup.
set -euo pipefail
cd "$(dirname "$0")/.."   # -> infra/

# Make a user-space rclone (no root install) discoverable under cron's minimal PATH.
export PATH="$HOME/.local/bin:$PATH"

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
# Smallest compressed dump accepted. The schema alone (70+ tables, indexes, Flyway history) is far
# above this; an empty or near-empty file means pg_dump produced nothing useful.
BACKUP_MIN_BYTES="${BACKUP_MIN_BYTES:-10240}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F_%H%M%S)"
OUT="$BACKUP_DIR/avicare_${DB_NAME:-avicare}_${STAMP}.sql.gz"
TMP="$OUT.tmp"

trap 'rm -f "$TMP"' EXIT

fail() { echo "ERROR: $*" >&2; exit 1; }

$COMPOSE exec -T postgres \
  pg_dump -U "${DB_USER:-avicare}" "${DB_NAME:-avicare}" | gzip > "$TMP" \
  || fail "pg_dump or gzip failed — nothing was kept."

SIZE="$(wc -c < "$TMP" | tr -d ' ')"
[ "$SIZE" -ge "$BACKUP_MIN_BYTES" ] \
  || fail "dump is only ${SIZE} bytes (minimum ${BACKUP_MIN_BYTES}) — discarded."
gzip -t "$TMP" || fail "gzip integrity check failed — discarded."
gunzip -c "$TMP" | tail -n 5 | grep "PostgreSQL database dump complete" >/dev/null \
  || fail "dump has no closing marker (truncated?) — discarded."

mv "$TMP" "$OUT"
echo "Local dump: $OUT ($(du -h "$OUT" | cut -f1))"

# Offsite copy (configure an rclone remote: Backblaze B2 / S3 / Contabo Object Storage).
OFFSITE_FAILED=0
if [ -n "${BACKUP_REMOTE:-}" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    echo "ERROR: BACKUP_REMOTE is set but rclone is not installed." >&2
    OFFSITE_FAILED=1
  elif rclone copy "$OUT" "$BACKUP_REMOTE"; then
    echo "Uploaded to $BACKUP_REMOTE"
  else
    echo "ERROR: rclone upload to $BACKUP_REMOTE failed." >&2
    OFFSITE_FAILED=1
  fi
else
  echo "NOTE: no offsite upload (set BACKUP_REMOTE in .env + install/configure rclone)"
fi

# Retain local copies for 14 days; sweep leftovers of interrupted runs.
find "$BACKUP_DIR" -maxdepth 1 -name "avicare_*.sql.gz" -mtime +14 -delete
find "$BACKUP_DIR" -maxdepth 1 -name "avicare_*.sql.gz.tmp" -mtime +1 -delete

[ "$OFFSITE_FAILED" -eq 0 ] || exit 1
