#!/usr/bin/env bash
# Require HOSTNAME to resolve (IPv4) to the approved EC2 address, retrying transient lookup failures.
# Usage: dns-check.sh <hostname> <expected-ipv4>
# Only public data (hostname, resolved addresses) is printed; the expected value is printed only
# when it is a well-formed IPv4 address.
set -Eeuo pipefail

host="${1:?hostname required}"
expected="${2:?expected IPv4 address required}"
attempts="${DNS_CHECK_ATTEMPTS:-5}"
delay="${DNS_CHECK_DELAY_SECONDS:-3}"

octet='(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])'
if ! [[ "$expected" =~ ^$octet\.$octet\.$octet\.$octet$ ]]; then
  bytes="$(printf '%s' "$expected" | wc -c)"
  if [[ "$expected" =~ [[:space:]] ]]; then issue=whitespace
  elif [[ "$bytes" -ne "${#expected}" ]]; then issue=non_ascii
  else issue=other
  fi
  echo "EXPECTED_PUBLIC_IPV4 is not a plain IPv4 address (bytes=${bytes}, issue=${issue})" >&2
  exit 2
fi
[[ "$attempts" =~ ^[1-9][0-9]*$ && "$delay" =~ ^[0-9]+$ ]] || { echo 'Invalid DNS retry settings' >&2; exit 2; }

for ((attempt = 1; attempt <= attempts; attempt++)); do
  addresses="$(getent ahostsv4 "$host" 2>/dev/null | awk '{print $1}' | sort -u || true)"
  if grep -Fxq "$expected" <<< "$addresses"; then
    echo "DNS: ${host} resolves to approved ${expected} (attempt ${attempt})"
    exit 0
  fi
  if [[ -z "$addresses" ]]; then
    echo "DNS: lookup of ${host} returned no IPv4 address (attempt ${attempt} of ${attempts})" >&2
  else
    echo "DNS: ${host} resolved to [$(tr '\n' ' ' <<< "$addresses" | sed 's/ $//')], expected ${expected} (attempt ${attempt} of ${attempts})" >&2
  fi
  if (( attempt < attempts )); then sleep "$delay"; fi
done
echo 'Staging DNS does not resolve to the approved EC2 IPv4 address' >&2
exit 2
