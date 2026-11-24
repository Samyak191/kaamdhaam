#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
: "${DEPLOY_ENV_FILE:?Set absolute server compose environment path}"
: "${BACKEND_ENV_FILE:?Set absolute server backend environment path}"
: "${STAGING_HOST:?Set the approved hostname}"
: "${EXPECTED_PUBLIC_IPV4:?Set the EC2 public IPv4 address}"
: "${EXPECTED_SUPABASE_URL:?Set the dedicated Supabase URL}"
: "${EXPECTED_SUPABASE_PUBLISHABLE_KEY:?Set its public publishable key}"
: "${AGE_RECIPIENT:?Set the age public recipient}"
: "${BACKUP_S3_URI:?Set the approved S3 backups prefix}"
: "${RELEASE_STATE_DIR:?Set the runner-owned persistent release state directory}"
[[ "$DEPLOY_ENV_FILE" == /* && "$BACKEND_ENV_FILE" == /* ]] || { echo 'Server environment paths must be absolute' >&2; exit 2; }
[[ -f "$DEPLOY_ENV_FILE" && -f "$BACKEND_ENV_FILE" ]] || { echo 'Server environment files missing' >&2; exit 2; }
[[ -d "$RELEASE_STATE_DIR" && -w "$RELEASE_STATE_DIR" ]] || { echo 'Release state directory missing or not writable' >&2; exit 2; }
for file in "$DEPLOY_ENV_FILE" "$BACKEND_ENV_FILE"; do
  mode="$(stat -c %a "$file")"
  [[ "$mode" =~ ^(400|440|600|640)$ ]] || { echo 'Environment file permissions must be 0600 or 0640 (or read-only)' >&2; exit 2; }
done
[[ "$AGE_RECIPIENT" =~ ^age1[a-z0-9]{40,}$ ]] || { echo 'Invalid age recipient' >&2; exit 2; }
[[ "$BACKUP_S3_URI" =~ ^s3://[a-z0-9][a-z0-9.-]+/backups/?$ ]] || { echo 'Invalid backup S3 prefix' >&2; exit 2; }
[[ "${AWS_DEFAULT_REGION:-}" == ap-southeast-2 ]] || { echo 'Expected AWS region ap-southeast-2' >&2; exit 2; }
python3 "$root/deploy/scripts/validate-env.py"

dns_addresses="$(getent ahostsv4 "$STAGING_HOST" | awk '{print $1}' | sort -u)"
grep -Fxq "$EXPECTED_PUBLIC_IPV4" <<< "$dns_addresses" || { echo 'Staging DNS does not resolve to the approved EC2 IPv4 address' >&2; exit 2; }
[[ -r "$root/deploy/Caddyfile" ]] || { echo 'Caddyfile missing' >&2; exit 2; }
if ! command -v docker >/dev/null || ! docker info --format '{{.ServerVersion}}' >/dev/null; then
  echo 'Docker is unavailable to the runner' >&2
  exit 2
fi
docker compose version >/dev/null
docker_root="$(docker info --format '{{.DockerRootDir}}')"
free_kib="$(df -Pk "$docker_root" | awk 'NR==2 {print $4}')"
total_kib="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
available_kib="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
[[ "$free_kib" -ge 6291456 ]] || { echo 'Docker filesystem needs at least 6 GiB free' >&2; exit 2; }
[[ "$total_kib" -ge 1800000 && "$available_kib" -ge 524288 ]] || { echo 'EC2 host lacks safe memory headroom' >&2; exit 2; }
docker run --rm -e "STAGING_HOST=$STAGING_HOST" -v "$root/deploy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2.10.0-alpine caddy validate --config /etc/caddy/Caddyfile >/dev/null

# Ignore any shared credentials and require the EC2 instance profile for S3.
role_aws=(env -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN -u AWS_PROFILE -u AWS_DEFAULT_PROFILE -u AWS_ROLE_ARN -u AWS_WEB_IDENTITY_TOKEN_FILE -u AWS_CONTAINER_CREDENTIALS_RELATIVE_URI -u AWS_CONTAINER_CREDENTIALS_FULL_URI -u AWS_EC2_METADATA_DISABLED AWS_SHARED_CREDENTIALS_FILE=/dev/null AWS_CONFIG_FILE=/dev/null aws)
role_arn="$("${role_aws[@]}" sts get-caller-identity --query Arn --output text)"
[[ "$role_arn" == arn:aws:sts::*:assumed-role/* ]] || { echo 'An EC2 instance role is required for backups' >&2; exit 2; }
bucket="${BACKUP_S3_URI#s3://}"
bucket="${bucket%%/*}"
"${role_aws[@]}" s3api list-objects-v2 --bucket "$bucket" --prefix backups/ --max-items 1 --query 'KeyCount' --output text >/dev/null
echo 'EC2 preflight passed: configuration, DNS, resources, TLS configuration, and backup role'
