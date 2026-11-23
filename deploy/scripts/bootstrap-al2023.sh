#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$(id -u)" == 0 ]] || { echo 'Run as root through approved SSM session' >&2; exit 2; }
grep -q '^ID="\?amzn"\?$' /etc/os-release || { echo 'Expected Amazon Linux 2023' >&2; exit 2; }
: "${COMPOSE_PLUGIN_URL:?Set the approved x86_64 Compose plugin release URL}"
: "${COMPOSE_PLUGIN_SHA256:?Set its verified SHA-256 digest}"
[[ "$COMPOSE_PLUGIN_SHA256" =~ ^[a-f0-9]{64}$ ]] || { echo 'Invalid Compose plugin SHA-256' >&2; exit 2; }
dnf update -y
dnf install -y docker git curl
systemctl enable --now docker
install -d -m 0755 /usr/local/lib/docker/cli-plugins
tmp="$(mktemp)"
trap 'rm -f -- "$tmp"' EXIT
curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 "$COMPOSE_PLUGIN_URL" -o "$tmp"
printf '%s  %s\n' "$COMPOSE_PLUGIN_SHA256" "$tmp" | sha256sum -c -
install -m 0755 "$tmp" /usr/local/lib/docker/cli-plugins/docker-compose
docker compose version
docker version
