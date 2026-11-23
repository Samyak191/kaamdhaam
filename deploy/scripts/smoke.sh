#!/usr/bin/env bash
set -Eeuo pipefail
: "${STAGING_ORIGIN:?Set the approved https:// staging origin}"
[[ "$STAGING_ORIGIN" =~ ^https://[A-Za-z0-9.-]+$ ]] || { echo 'STAGING_ORIGIN must be an HTTPS origin without a path' >&2; exit 2; }
for path in / /login /reset-password /v1/health /v1/ready; do
  code="$(curl --fail-with-body --silent --show-error --location --max-time 15 --output /dev/null --write-out '%{http_code}' "$STAGING_ORIGIN$path")"
  [[ "$code" == 200 ]] || { echo "Unexpected status for $path: $code" >&2; exit 1; }
  echo "PASS $path"
done
headers="$(curl --silent --show-error --head --max-time 15 "$STAGING_ORIGIN/v1/health")"
grep -qi '^x-content-type-options: nosniff' <<< "$headers" || { echo 'Missing nosniff header' >&2; exit 1; }
echo 'PASS security header'
