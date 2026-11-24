#!/usr/bin/env bash
# Prepare the existing EC2 host. This script never starts containers or changes AWS resources.
set -Eeuo pipefail
umask 077

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[[ -d "$root/.git" ]] || { echo 'Run from a trusted Git checkout' >&2; exit 2; }
[[ "$(id -u)" == 0 ]] || { echo 'Run as root from an approved SSM session' >&2; exit 2; }
grep -q '^ID="\?amzn"\?$' /etc/os-release || { echo 'Expected Amazon Linux 2023' >&2; exit 2; }

runner_user="${1:?Usage: sudo bash deploy/scripts/bootstrap-existing-ec2.sh RUNNER_SERVICE_USER}"
id "$runner_user" >/dev/null || { echo 'Runner service account does not exist' >&2; exit 2; }
runner_group="$(id -gn "$runner_user")"
for command in docker python3 aws git runuser stat df awk sed; do
  command -v "$command" >/dev/null || { echo "Missing prerequisite: $command" >&2; exit 2; }
done
docker info --format '{{.ServerVersion}}' >/dev/null
docker compose version >/dev/null
runuser -u "$runner_user" -- docker info --format '{{.ServerVersion}}' >/dev/null || {
  echo 'Runner account cannot use Docker' >&2; exit 2;
}

docker_root="$(docker info --format '{{.DockerRootDir}}')"
free_kib="$(df -Pk "$docker_root" | awk 'NR==2 {print $4}')"
total_kib="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
available_kib="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
[[ "$free_kib" -ge 6291456 ]] || { echo 'Docker filesystem needs at least 6 GiB free' >&2; exit 2; }
[[ "$total_kib" -ge 1800000 && "$available_kib" -ge 524288 ]] || {
  echo 'EC2 host lacks safe memory headroom' >&2; exit 2;
}

compose_env=/etc/kaamdhaam/compose.env
backend_env=/etc/kaamdhaam/backend.env
state_dir=/opt/kaamdhaam/state
volume=kaamdham-beta_postgres_data
if [[ -e "$compose_env" || -e "$backend_env" ]]; then
  [[ -f "$compose_env" && -f "$backend_env" ]] || {
    echo 'Only one server environment file exists; resolve manually without overwriting it' >&2; exit 2;
  }
  echo 'Existing server environment files retained'
else
  if docker volume inspect "$volume" >/dev/null 2>&1; then
    echo 'An existing KaamDhaam PostgreSQL volume needs its original credentials; no new files generated' >&2
    exit 2
  fi
  [[ -r /dev/tty ]] || { echo 'Private interactive terminal required for initial configuration' >&2; exit 2; }
  install -d -o root -g "$runner_group" -m 0750 /etc/kaamdhaam
  # Python reads from the terminal, creates a random DB password, and atomically
  # installs root-owned files readable by the runner group. It prints no values.
  KAAMDHAAM_RUNNER_GROUP="$runner_group" python3 - "$compose_env" "$backend_env" <<'PY'
import grp
import os
import secrets
import sys
import tempfile
import termios
from pathlib import Path
from urllib.parse import quote


def read_tty_line(prompt, hidden=False):
    # stdin contains this heredoc, and SSM's terminal cannot be opened in r+ mode.
    fd = os.open('/dev/tty', os.O_RDWR | os.O_NOCTTY)
    previous = None
    try:
        if hidden:
            previous = termios.tcgetattr(fd)
            no_echo = previous.copy()
            no_echo[3] &= ~termios.ECHO
            termios.tcsetattr(fd, termios.TCSANOW, no_echo)
        os.write(fd, prompt.encode('utf-8'))
        value = bytearray()
        while len(value) < 4096:
            character = os.read(fd, 1)
            if not character:
                raise ValueError('Terminal input ended unexpectedly')
            if character in (b'\n', b'\r'):
                return value.decode('utf-8')
            value.extend(character)
        raise ValueError('Terminal input is too long')
    finally:
        if previous is not None:
            termios.tcsetattr(fd, termios.TCSANOW, previous)
            os.write(fd, b'\n')
        os.close(fd)


compose_path, backend_path = map(Path, sys.argv[1:])
url = read_tty_line('Dedicated KaamDhaam Supabase URL: ').strip()
key = read_tty_line('Supabase publishable key (hidden): ', hidden=True)
if url.rstrip('/') != 'https://tvynmgcbyathsgguezye.supabase.co' or not key.startswith('sb_publishable_'):
    raise SystemExit('Dedicated Supabase public configuration is invalid')
url = url.rstrip('/')
host = 'staging.kaam-dhaam.in'
name = 'kaamdham_beta'
password = secrets.token_urlsafe(36)
db_url = f'postgresql://{name}:{quote(password, safe="")}@db:5432/{name}?schema=public'
compose = '\n'.join((f'POSTGRES_DB={name}', f'POSTGRES_USER={name}', f'POSTGRES_PASSWORD={password}',
    'HTTP_PORT=8080', f'STAGING_HOST={host}', f'VITE_SUPABASE_URL={url}',
    f'VITE_SUPABASE_PUBLISHABLE_KEY={key}', f'BACKEND_ENV_FILE={backend_path}', ''))
backend = '\n'.join(('NODE_ENV=production', 'HOST=0.0.0.0', 'PORT=4000', f'DATABASE_URL={db_url}',
    f'CORS_ORIGINS=https://{host}', 'TRUST_PROXY_HOPS=1', 'RATE_LIMIT_PER_MINUTE=600',
    'RATE_LIMIT_WRITE_PER_MINUTE=30', f'SUPABASE_ISSUER={url}/auth/v1',
    'SUPABASE_AUDIENCE=authenticated', f'SUPABASE_JWKS_URL={url}/auth/v1/.well-known/jwks.json', ''))
gid = grp.getgrnam(os.environ['KAAMDHAAM_RUNNER_GROUP']).gr_gid
created = []
try:
    for path, content in ((compose_path, compose), (backend_path, backend)):
        fd, temporary = tempfile.mkstemp(prefix='.bootstrap-', dir=path.parent)
        try:
            os.fchmod(fd, 0o640)
            os.fchown(fd, 0, gid)
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())
            os.link(temporary, path)  # Fails if another process created the file.
            created.append(path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
except Exception:
    for path in created:
        path.unlink()
    raise
PY
  echo 'New server environment files created with restricted permissions'
fi

install -d -o "$runner_user" -g "$runner_group" -m 0750 "$state_dir"
for file in "$compose_env" "$backend_env"; do
  [[ ! -L "$file" ]] || { echo 'Server environment files must not be symbolic links' >&2; exit 2; }
  mode="$(stat -c %a "$file")"
  [[ "$mode" =~ ^(400|440|600|640)$ ]] || { echo 'Unsafe server environment file mode' >&2; exit 2; }
  runuser -u "$runner_user" -- test -r "$file" || { echo 'Runner cannot read server configuration' >&2; exit 2; }
done
runuser -u "$runner_user" -- test -w "$state_dir" || { echo 'Runner cannot write release state' >&2; exit 2; }

export DEPLOY_ENV_FILE="$compose_env" BACKEND_ENV_FILE="$backend_env"
export STAGING_HOST=staging.kaam-dhaam.in
export EXPECTED_SUPABASE_URL=https://tvynmgcbyathsgguezye.supabase.co
EXPECTED_SUPABASE_PUBLISHABLE_KEY="$(sed -n 's/^VITE_SUPABASE_PUBLISHABLE_KEY=//p' "$compose_env")"
export EXPECTED_SUPABASE_PUBLISHABLE_KEY
python3 "$root/deploy/scripts/validate-env.py"
unset EXPECTED_SUPABASE_PUBLISHABLE_KEY

RELEASE_GIT_SHA="$(git -C "$root" rev-parse HEAD)"
export RELEASE_GIT_SHA
docker compose --env-file "$compose_env" -f "$root/deploy/compose.yaml" \
  -f "$root/deploy/staging.compose.yaml" -f "$root/deploy/ghcr.compose.yaml" \
  -p kaamdham-beta config --quiet
for service in migrate backend web; do
  runuser -u "$runner_user" -- docker manifest inspect \
    "ghcr.io/samyak191/kaamdhaam-${service}:${RELEASE_GIT_SHA}" >/dev/null || {
    echo "Runner cannot inspect the published GHCR $service image for this checkout" >&2
    exit 2
  }
done
if docker volume inspect "$volume" >/dev/null 2>&1; then
  echo 'Existing PostgreSQL volume found; first release must use initial_empty_db=false'
else
  echo 'No KaamDhaam PostgreSQL volume found; first release may use initial_empty_db=true after review'
fi
echo 'Host preparation passed. Authenticated image pull, S3 backup, DNS and HTTPS remain release gates.'
