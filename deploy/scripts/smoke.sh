#!/usr/bin/env bash
# Public HTTPS acceptance for a release: routes, API health/readiness, security headers and
# certificate validity. Containers being "up" is never sufficient on its own.
set -Eeuo pipefail
: "${STAGING_ORIGIN:?Set the approved https:// staging origin}"
[[ "$STAGING_ORIGIN" =~ ^https://[A-Za-z0-9.-]+$ ]] || { echo 'STAGING_ORIGIN must be an HTTPS origin without a path' >&2; exit 2; }
host="${STAGING_ORIGIN#https://}"
min_cert_days="${SMOKE_MIN_CERT_DAYS:-14}"

for path in / /login /signup /jobs /talent /reset-password /v1/health /v1/ready; do
  passed=false
  for ((attempt=1; attempt<=12; attempt++)); do
    code="$(curl --silent --location --max-time 10 --output /dev/null --write-out '%{http_code}' "$STAGING_ORIGIN$path" || true)"
    if [[ "$code" == 200 ]]; then passed=true; break; fi
    sleep 5
  done
  [[ "$passed" == true ]] || { echo "HTTPS smoke check failed for $path (last status ${code:-none})" >&2; exit 1; }
  echo "PASS $path"
done

health="$(curl --silent --max-time 10 "$STAGING_ORIGIN/v1/health")"
grep -q '"status":"ok"' <<< "$health" || { echo 'API health body is not ok' >&2; exit 1; }
echo 'PASS api health body'

headers="$(curl --silent --show-error --head --max-time 15 "$STAGING_ORIGIN/v1/health")"
grep -qi '^x-content-type-options: nosniff' <<< "$headers" || { echo 'Missing nosniff header' >&2; exit 1; }
grep -qi '^strict-transport-security:' <<< "$headers" || { echo 'Missing Strict-Transport-Security header' >&2; exit 1; }
echo 'PASS security headers'

# curl already rejected an untrusted chain above; additionally require remaining validity.
if command -v openssl >/dev/null; then
  not_after="$(openssl s_client -servername "$host" -connect "$host:443" -verify_return_error </dev/null 2>/dev/null \
    | openssl x509 -noout -enddate | cut -d= -f2)"
  [[ -n "$not_after" ]] || { echo 'Could not read the TLS certificate' >&2; exit 1; }
  expires="$(date -u -d "$not_after" +%s)"
  remaining_days=$(( (expires - $(date -u +%s)) / 86400 ))
  [[ "$remaining_days" -ge "$min_cert_days" ]] || { echo "TLS certificate expires in ${remaining_days} days" >&2; exit 1; }
  echo "PASS tls certificate valid for ${remaining_days} more days"
else
  echo 'WARN openssl unavailable; certificate expiry not checked'
fi
