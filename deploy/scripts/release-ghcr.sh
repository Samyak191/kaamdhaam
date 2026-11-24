#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
config="$root/deploy"
: "${COMPOSE_PROJECT_NAME:?Set the existing approved Compose project name}"
: "${DEPLOY_ENV_FILE:?Set absolute server compose env path}"
: "${BACKEND_ENV_FILE:?Set absolute server backend env path}"
: "${MIGRATIONS_REVIEWED_SHA:?Set the reviewed release SHA}"
: "${INITIAL_EMPTY_DB:?Explicitly state true or false}"
: "${RELEASE_STATE_DIR:?Set persistent release state directory}"
[[ "$COMPOSE_PROJECT_NAME" =~ ^[a-z][a-z0-9_-]*$ ]] || { echo 'Invalid Compose project name' >&2; exit 2; }
[[ "$INITIAL_EMPTY_DB" == true || "$INITIAL_EMPTY_DB" == false ]] || { echo 'INITIAL_EMPTY_DB must be true or false' >&2; exit 2; }
[[ -z "$(git -C "$root" status --porcelain)" ]] || { echo 'Release checkout must be clean' >&2; exit 2; }
RELEASE_GIT_SHA="$(git -C "$root" rev-parse HEAD)"
export RELEASE_GIT_SHA
[[ "$RELEASE_GIT_SHA" =~ ^[a-f0-9]{40}$ && "$MIGRATIONS_REVIEWED_SHA" == "$RELEASE_GIT_SHA" ]] || { echo 'Migration review does not match the release commit' >&2; exit 2; }

# No Compose operation is allowed before server, DNS, TLS, role, and resource checks pass.
bash "$config/scripts/preflight-ec2.sh"
compose=(docker compose --env-file "$DEPLOY_ENV_FILE" -f "$config/compose.yaml" -f "$config/staging.compose.yaml" -f "$config/ghcr.compose.yaml" -p "$COMPOSE_PROJECT_NAME")
"${compose[@]}" config --quiet
"${compose[@]}" config --format json | python3 -c 'import json,sys; s=json.load(sys.stdin)["services"]; assert all("build" not in s[n] for n in ("migrate","backend","web")), "Application build contexts are forbidden on EC2"'

volume="${COMPOSE_PROJECT_NAME}_postgres_data"
if docker volume inspect "$volume" >/dev/null 2>&1; then
  [[ "$INITIAL_EMPTY_DB" == false ]] || { echo 'Existing database volume requires a backup; initial-empty flag is invalid' >&2; exit 2; }
else
  [[ "$INITIAL_EMPTY_DB" == true ]] || { echo 'Database volume absent; explicitly approve initial empty database' >&2; exit 2; }
fi

for service in migrate backend web; do
  docker pull "ghcr.io/samyak191/kaamdhaam-${service}:${RELEASE_GIT_SHA}" >/dev/null
done
docker pull postgres:17.12-alpine3.24 >/dev/null
docker pull caddy:2.10.0-alpine >/dev/null
for service in migrate backend web; do
  image="ghcr.io/samyak191/kaamdhaam-${service}:${RELEASE_GIT_SHA}"
  actual="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")"
  [[ "$actual" == "$RELEASE_GIT_SHA" ]] || { echo "Image revision mismatch: $service" >&2; exit 1; }
done

"${compose[@]}" up -d --no-build --wait --wait-timeout 120 db
if [[ "$INITIAL_EMPTY_DB" == false ]]; then
  bash "$config/scripts/backup.sh"
fi

# The one-shot migrate service runs Prisma migrate deploy. Backend waits for its success.
"${compose[@]}" up -d --no-build --wait --wait-timeout 180
export STAGING_ORIGIN="https://${STAGING_HOST}"
bash "$config/scripts/smoke.sh"
for service in backend web; do
  container="$("${compose[@]}" ps -q "$service")"
  actual="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$container")"
  [[ "$actual" == "$RELEASE_GIT_SHA" ]] || { echo "Running revision mismatch: $service" >&2; exit 1; }
done

if [[ -f "$RELEASE_STATE_DIR/current" ]]; then
  previous="$(cat "$RELEASE_STATE_DIR/current")"
  if [[ "$previous" != "$RELEASE_GIT_SHA" ]]; then
    temp="$(mktemp "$RELEASE_STATE_DIR/.previous.XXXXXX")"
    printf '%s\n' "$previous" > "$temp"
    mv -- "$temp" "$RELEASE_STATE_DIR/previous"
  fi
fi
temp="$(mktemp "$RELEASE_STATE_DIR/.current.XXXXXX")"
printf '%s\n' "$RELEASE_GIT_SHA" > "$temp"
mv -- "$temp" "$RELEASE_STATE_DIR/current"
echo "Deployment healthy at commit $RELEASE_GIT_SHA"
