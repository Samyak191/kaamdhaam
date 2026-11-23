#!/usr/bin/env bash
set -Eeuo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
config="$root/deploy"
: "${COMPOSE_PROJECT_NAME:?Set the approved Compose project name}"
: "${STAGING_HOST:?Set the approved DNS hostname}"
: "${AGE_RECIPIENT:?Set the backup public recipient}"
: "${BACKUP_S3_URI:?Set the approved off-host S3 backup prefix}"
: "${STAGING_ORIGIN:?Set the approved HTTPS origin}"
: "${MIGRATIONS_REVIEWED_SHA:?Set the Git SHA after reviewing pending migration SQL}"
[[ "$STAGING_ORIGIN" == "https://$STAGING_HOST" ]] || { echo 'Host and origin disagree' >&2; exit 2; }
[[ -f "$config/.env" && -f "$config/backend.env" ]] || { echo 'Missing ignored deployment env files' >&2; exit 2; }
[[ -z "$(git -C "$root" status --porcelain)" ]] || { echo 'Release checkout is not clean' >&2; exit 2; }
export RELEASE_GIT_SHA="$(git -C "$root" rev-parse HEAD)"
[[ "$MIGRATIONS_REVIEWED_SHA" == "$RELEASE_GIT_SHA" ]] || { echo 'Migration review SHA does not match release' >&2; exit 2; }
compose=(docker compose --env-file "$config/.env" -f "$config/compose.yaml" -f "$config/staging.compose.yaml" -p "$COMPOSE_PROJECT_NAME")
"${compose[@]}" config --quiet
"${compose[@]}" build backend web migrate
bash "$config/scripts/backup.sh"
# Compose blocks backend on successful Prisma migrate deploy. A failed migration stops release.
"${compose[@]}" up -d --no-build
bash "$config/scripts/smoke.sh"
for service in backend web; do
  image="$("${compose[@]}" images -q "$service")"
  actual="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")"
  [[ "$actual" == "$RELEASE_GIT_SHA" ]] || { echo "Revision mismatch: $service" >&2; exit 1; }
done
echo "Release healthy at commit $RELEASE_GIT_SHA"
