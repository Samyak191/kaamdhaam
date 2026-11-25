#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
config="$root/deploy"
: "${DEPLOY_ENV_FILE:?Set absolute server compose env path}"
: "${BACKEND_ENV_FILE:?Set absolute server backend env path}"
: "${MIGRATIONS_REVIEWED_SHA:?Set the reviewed release SHA}"
: "${INITIAL_EMPTY_DB:?Explicitly state true or false}"
: "${RELEASE_STATE_DIR:?Set persistent release state directory}"
if [[ -z "${COMPOSE_PROJECT_NAME:-}" ]]; then
  echo 'Compose project identity missing (bytes=0); expected approved kaamdham-beta' >&2
  exit 2
fi
if [[ "$COMPOSE_PROJECT_NAME" != kaamdham-beta ]]; then
  received_bytes="$(printf '%s' "$COMPOSE_PROJECT_NAME" | wc -c)"
  if [[ "$COMPOSE_PROJECT_NAME" =~ [[:space:]] ]]; then character_class=whitespace
  elif [[ "$received_bytes" -ne "${#COMPOSE_PROJECT_NAME}" ]]; then character_class=non_ascii
  else character_class=other
  fi
  printf 'Compose project identity mismatch (bytes=%s, character_class=%s); expected approved kaamdham-beta\n' "$received_bytes" "$character_class" >&2
  exit 2
fi
[[ "$INITIAL_EMPTY_DB" == true || "$INITIAL_EMPTY_DB" == false ]] || { echo 'INITIAL_EMPTY_DB must be true or false' >&2; exit 2; }
[[ -z "$(git -C "$root" status --porcelain)" ]] || { echo 'Release checkout must be clean' >&2; exit 2; }
RELEASE_GIT_SHA="$(git -C "$root" rev-parse HEAD)"
export RELEASE_GIT_SHA
[[ "$RELEASE_GIT_SHA" =~ ^[a-f0-9]{40}$ && "$MIGRATIONS_REVIEWED_SHA" == "$RELEASE_GIT_SHA" ]] || { echo 'Migration review does not match the release commit' >&2; exit 2; }

# Trigger provenance. The automatic path (workflow_run) can never initialise an empty database
# or self-approve destructive migrations; both remain manual-dispatch decisions.
: "${RELEASE_TRIGGER:=workflow_dispatch}"
: "${DESTRUCTIVE_MIGRATIONS_REVIEWED:=false}"
[[ "$RELEASE_TRIGGER" == workflow_run || "$RELEASE_TRIGGER" == workflow_dispatch ]] || { echo 'RELEASE_TRIGGER must be workflow_run or workflow_dispatch' >&2; exit 2; }
[[ "$DESTRUCTIVE_MIGRATIONS_REVIEWED" == true || "$DESTRUCTIVE_MIGRATIONS_REVIEWED" == false ]] || { echo 'DESTRUCTIVE_MIGRATIONS_REVIEWED must be true or false' >&2; exit 2; }
if [[ "$RELEASE_TRIGGER" == workflow_run ]]; then
  [[ "$INITIAL_EMPTY_DB" == false ]] || { echo 'Automatic releases can never initialise an empty database' >&2; exit 2; }
  [[ "$DESTRUCTIVE_MIGRATIONS_REVIEWED" == false ]] || { echo 'Automatic releases cannot carry a destructive-migration review' >&2; exit 2; }
fi

record_outcome() {
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf 'outcome=%s\ndeployed_sha=%s\n' "$1" "$2" >> "$GITHUB_OUTPUT"
  fi
}

# Release ordering. CI runs can finish out of order; a commit that is an ancestor of the
# currently deployed commit is never deployed over it. Unknown or rewritten history fails closed.
previous_release=""
if [[ -f "$RELEASE_STATE_DIR/current" ]]; then
  previous_release="$(tr -d '[:space:]' < "$RELEASE_STATE_DIR/current")"
  [[ "$previous_release" =~ ^[a-f0-9]{40}$ ]] || { echo 'Recorded deployed commit is malformed' >&2; exit 2; }
  if [[ "$previous_release" == "$RELEASE_GIT_SHA" ]]; then
    echo "Release commit $RELEASE_GIT_SHA is already the recorded deployment; re-verifying it"
  elif ! git -C "$root" cat-file -e "${previous_release}^{commit}" 2>/dev/null; then
    echo "Deployed commit $previous_release is absent from the release checkout history (shallow clone or rewritten main); refusing" >&2
    exit 2
  elif git -C "$root" merge-base --is-ancestor "$RELEASE_GIT_SHA" "$previous_release"; then
    echo "Release commit $RELEASE_GIT_SHA is older than the deployed $previous_release; skipping so the newer release stays live"
    record_outcome superseded "$previous_release"
    exit 0
  elif git -C "$root" merge-base --is-ancestor "$previous_release" "$RELEASE_GIT_SHA"; then
    echo "Release commit descends from the deployed $previous_release"
  else
    echo "Deployed commit $previous_release and release commit $RELEASE_GIT_SHA have diverged histories; refusing" >&2
    exit 2
  fi
fi

# New migrations since the deployed commit must be additive unless a human reviewed them.
python3 "$config/scripts/migration-guard.py" --repo "$root" --release "$RELEASE_GIT_SHA" \
  --previous "$previous_release" --reviewed "$DESTRUCTIVE_MIGRATIONS_REVIEWED" --initial-empty-db "$INITIAL_EMPTY_DB"

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
record_outcome deployed "$RELEASE_GIT_SHA"
echo "Deployment healthy at commit $RELEASE_GIT_SHA"
