#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
config="$root/deploy"
: "${COMPOSE_PROJECT_NAME:?Set an isolated Compose project name}"
: "${AGE_IDENTITY_FILE:?Set the path to an age identity file}"
: "${RESTORE_DB:?Set a NEW database name ending in _restore_check}"
: "${BACKUP_FILE:?Set a local encrypted backup file}"
[[ "$RESTORE_DB" =~ ^[a-z][a-z0-9_]*_restore_check$ ]] || { echo 'Unsafe restore database name' >&2; exit 2; }
[[ -f "$AGE_IDENTITY_FILE" && -f "$BACKUP_FILE" ]] || { echo 'Identity or backup file missing' >&2; exit 2; }
[[ -f "$config/.env" && -f "$config/backend.env" ]] || { echo 'Deployment env files missing' >&2; exit 2; }
identity="$(cd "$(dirname "$AGE_IDENTITY_FILE")" && pwd)/$(basename "$AGE_IDENTITY_FILE")"
if command -v cygpath >/dev/null 2>&1; then identity="$(cygpath -w "$identity")"; fi
docker build -q -f "$config/backup-age.Dockerfile" -t kaamdham-backup-age:1 "$config" >/dev/null
decrypt() {
  MSYS_NO_PATHCONV=1 docker run --rm -i -v "$identity:/keys/identity:ro" kaamdham-backup-age:1 -d -i /keys/identity < "$BACKUP_FILE"
}
compose=(docker compose --env-file "$config/.env" -f "$config/compose.yaml" -p "$COMPOSE_PROJECT_NAME")

# Validate the encrypted archive before creating a database. No plaintext dump is written to disk.
decrypt | "${compose[@]}" exec -T db pg_restore -l >/dev/null
"${compose[@]}" exec -T db sh -ec 'test "$1" != "$POSTGRES_DB"; ! psql -U "$POSTGRES_USER" -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = '\''$1'\''" | grep -q 1; createdb -U "$POSTGRES_USER" "$1"' sh "$RESTORE_DB"
decrypt | "${compose[@]}" exec -T db sh -ec 'pg_restore --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d "$1"' sh "$RESTORE_DB"
"${compose[@]}" exec -T db sh -ec 'psql -U "$POSTGRES_USER" -d "$1" -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema = '\''public'\'' AND table_type = '\''BASE TABLE'\''"' sh "$RESTORE_DB" | sed 's/^/Restored public tables: /'
echo "Restore check complete in new database: $RESTORE_DB"
