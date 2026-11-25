#!/usr/bin/env bash
# Post-release diagnostics for the workflow log: container state, health, running revisions,
# recorded release SHAs, disk, and recent logs with connection strings redacted. Never prints
# environment file contents.
set -Eeuo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
config="$root/deploy"
: "${COMPOSE_PROJECT_NAME:?Set the Compose project name}"
: "${DEPLOY_ENV_FILE:?Set absolute server compose env path}"
: "${RELEASE_STATE_DIR:?Set persistent release state directory}"
log_lines="${STATUS_LOG_LINES:-60}"
[[ "$log_lines" =~ ^[0-9]+$ ]] || { echo 'STATUS_LOG_LINES must be numeric' >&2; exit 2; }
export RELEASE_GIT_SHA="${RELEASE_GIT_SHA:-unknown}"
compose=(docker compose --env-file "$DEPLOY_ENV_FILE" -f "$config/compose.yaml" -f "$config/staging.compose.yaml" -f "$config/ghcr.compose.yaml" -p "$COMPOSE_PROJECT_NAME")

redact() { sed -E 's#(postgres(ql)?://[^:/@[:space:]]+:)[^@[:space:]]*@#\1***@#g; s#(password|secret|token|api[_-]?key)(["'"'"']?\s*[:=]\s*["'"'"']?)[^[:space:],;"'"'"']+#\1\2***#Ig'; }

echo '== recorded release state'
for name in current previous; do
  if [[ -f "$RELEASE_STATE_DIR/$name" ]]; then printf '%s: %s\n' "$name" "$(tr -d '[:space:]' < "$RELEASE_STATE_DIR/$name")"; else printf '%s: (none)\n' "$name"; fi
done

echo '== containers'
"${compose[@]}" ps --all --format 'table {{.Service}}\t{{.State}}\t{{.Status}}\t{{.Image}}' 2>/dev/null || docker ps --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'

echo '== health and revisions'
for service in db migrate backend web caddy; do
  container="$("${compose[@]}" ps -a -q "$service" 2>/dev/null | head -n1 || true)"
  if [[ -z "$container" ]]; then printf '%-8s absent\n' "$service"; continue; fi
  state="$(docker inspect --format '{{.State.Status}}' "$container")"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}' "$container")"
  revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$container")"
  restarts="$(docker inspect --format '{{.RestartCount}}' "$container")"
  printf '%-8s state=%s health=%s restarts=%s revision=%s\n' "$service" "$state" "$health" "$restarts" "${revision:-none}"
done

echo '== newest local encrypted backup'
if [[ -n "${BACKUP_OUTPUT_DIR:-}" && -d "$BACKUP_OUTPUT_DIR" ]]; then
  find "$BACKUP_OUTPUT_DIR" -maxdepth 1 -type f -name "${COMPOSE_PROJECT_NAME}-*.dump.age" -printf '%TY-%Tm-%TdT%TH:%TM:%TSZ %s bytes %f\n' 2>/dev/null | sort -r | head -n1 || true
else
  echo '(BACKUP_OUTPUT_DIR not set)'
fi

echo '== database volume'
docker volume inspect --format '{{.Name}} created={{.CreatedAt}}' "${COMPOSE_PROJECT_NAME}_postgres_data" 2>/dev/null || echo "${COMPOSE_PROJECT_NAME}_postgres_data: ABSENT"

echo '== disk and memory'
df -Ph "$(docker info --format '{{.DockerRootDir}}')" | tail -n1
awk '/^MemTotal:|^MemAvailable:/ {printf "%s %d MiB\n", $1, $2/1024}' /proc/meminfo

if [[ "$log_lines" -gt 0 ]]; then
  echo "== recent logs (last ${log_lines} lines, redacted)"
  "${compose[@]}" logs --tail "$log_lines" --no-color --timestamps migrate backend web caddy 2>&1 | redact || true
fi
