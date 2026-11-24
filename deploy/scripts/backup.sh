#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
config="$root/deploy"
deploy_env_file="${DEPLOY_ENV_FILE:-$config/.env}"
backend_env_file="${BACKEND_ENV_FILE:-$config/backend.env}"
: "${COMPOSE_PROJECT_NAME:?Set the approved Compose project name}"
: "${AGE_RECIPIENT:?Set an age public recipient; keep the private identity off the host}"
[[ "$AGE_RECIPIENT" == age1* ]] || { echo 'Invalid age recipient' >&2; exit 2; }
[[ -f "$deploy_env_file" && -f "$backend_env_file" ]] || { echo 'Missing deployment environment files' >&2; exit 2; }
if [[ -n "${BACKUP_S3_URI:-}" ]]; then
  BACKUP_S3_URI="${BACKUP_S3_URI%/}"
  [[ "$BACKUP_S3_URI" =~ ^s3://[a-z0-9][a-z0-9.-]+/backups$ ]] || { echo 'BACKUP_S3_URI must be the approved backup prefix' >&2; exit 2; }
fi

output_dir="${BACKUP_OUTPUT_DIR:-$config/backups}"
mkdir -p "$output_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="$output_dir/${COMPOSE_PROJECT_NAME}-${stamp}.dump.age"
partial="${destination}.partial"
[[ ! -e "$destination" && ! -e "$partial" ]] || { echo 'Backup filename already exists' >&2; exit 2; }
trap 'rm -f -- "$partial"' EXIT

docker build -q -f "$config/backup-age.Dockerfile" -t kaamdham-backup-age:1 "$config" >/dev/null
docker compose --env-file "$deploy_env_file" -f "$config/compose.yaml" -p "$COMPOSE_PROJECT_NAME" \
  exec -T db sh -ec 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  | docker run --rm -i kaamdham-backup-age:1 -r "$AGE_RECIPIENT" > "$partial"
[[ -s "$partial" ]] || { echo 'Encrypted backup is empty' >&2; exit 1; }
mv -- "$partial" "$destination"
trap - EXIT
printf '%s  %s\n' "$(sha256sum "$destination" | cut -d' ' -f1)" "$(basename "$destination")" > "${destination}.sha256"

if [[ -n "${BACKUP_S3_URI:-}" ]]; then
  role_aws=(env -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN -u AWS_PROFILE -u AWS_DEFAULT_PROFILE -u AWS_ROLE_ARN -u AWS_WEB_IDENTITY_TOKEN_FILE -u AWS_CONTAINER_CREDENTIALS_RELATIVE_URI -u AWS_CONTAINER_CREDENTIALS_FULL_URI -u AWS_EC2_METADATA_DISABLED AWS_SHARED_CREDENTIALS_FILE=/dev/null AWS_CONFIG_FILE=/dev/null aws)
  "${role_aws[@]}" s3 cp --only-show-errors --sse AES256 "$destination" "$BACKUP_S3_URI/$(basename "$destination")"
  "${role_aws[@]}" s3 cp --only-show-errors --sse AES256 "${destination}.sha256" "$BACKUP_S3_URI/$(basename "$destination").sha256"
fi
echo "Encrypted backup complete: $destination"
