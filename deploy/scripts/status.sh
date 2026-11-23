#!/usr/bin/env bash
set -Eeuo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
: "${COMPOSE_PROJECT_NAME:?Set the Compose project name}"
compose=(docker compose --env-file "$root/deploy/.env" -f "$root/deploy/compose.yaml" -f "$root/deploy/staging.compose.yaml" -p "$COMPOSE_PROJECT_NAME")
"${compose[@]}" ps
"${compose[@]}" logs --tail 40 --no-color backend db caddy
df -h "$root"
