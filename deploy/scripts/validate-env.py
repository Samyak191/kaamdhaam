#!/usr/bin/env python3
"""Check release configuration without printing secret values."""
import hashlib
import os
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse


def fail(message: str) -> None:
    raise ValueError(message)


def read_env(path: str) -> dict[str, str]:
    data: dict[str, str] = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            fail("Malformed environment file")
        key, value = line.split("=", 1)
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", key):
            fail("Malformed environment key")
        if value.startswith(('"', "'")) and value.endswith(value[0]):
            value = value[1:-1]
        data[key] = value
    return data


def shape(value: str) -> str:
    """Describe a value without revealing it: only length, character classes and a hash prefix."""
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:8]
    flags = []
    if value != value.strip():
        flags.append("outer_whitespace")
    if "\r" in value or "\n" in value:
        flags.append("line_break")
    if not value.isascii():
        flags.append("non_ascii")
    if value[:1] in ('"', "'") or value[-1:] in ('"', "'"):
        flags.append("quoted")
    if not value.startswith("sb_publishable_"):
        flags.append("unexpected_prefix")
    return f"chars={len(value)} sha256_8={digest} flags={','.join(flags) or 'none'}"


CR = chr(13).encode()


def raw_line_shape(path: str, key: str) -> str:
    """Report how KEY appears in the file on disk (trailing CR, spaces, quotes) before parsing."""
    raw = Path(path).read_bytes()
    for line in raw.split(b"\n"):
        if line.split(b"=", 1)[0].strip() == key.encode():
            value = line.split(b"=", 1)[1]
            trailing_cr = value.endswith(CR)
            trailing_space = value.rstrip(CR) != value.rstrip(CR).rstrip()
            return f"raw_bytes={len(value)} trailing_cr={trailing_cr} trailing_space={trailing_space}"
    return "absent"


def required(data: dict[str, str], key: str) -> str:
    value = data.get(key, "")
    if not value or "replace" in value.lower() or "your-" in value.lower():
        fail(f"Missing or placeholder {key}")
    return value


try:
    public = read_env(os.environ["DEPLOY_ENV_FILE"])
    backend = read_env(os.environ["BACKEND_ENV_FILE"])
    hostname = os.environ["STAGING_HOST"]
    expected_url = os.environ["EXPECTED_SUPABASE_URL"].rstrip("/")
    expected_key = os.environ["EXPECTED_SUPABASE_PUBLISHABLE_KEY"]
    if expected_url != "https://tvynmgcbyathsgguezye.supabase.co":
        fail("Only the dedicated KaamDhaam Supabase project is allowed")
    if not re.fullmatch(r"(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?", hostname) or hostname.endswith(".invalid"):
        fail("Invalid staging hostname")
    if required(public, "STAGING_HOST") != hostname:
        fail("Staging hostname mismatch")
    if required(public, "VITE_SUPABASE_URL").rstrip("/") != expected_url:
        fail("Frontend Supabase URL mismatch")
    if required(public, "VITE_SUPABASE_PUBLISHABLE_KEY") != expected_key:
        print("Server file key: " + shape(public["VITE_SUPABASE_PUBLISHABLE_KEY"])
              + "; " + raw_line_shape(os.environ["DEPLOY_ENV_FILE"], "VITE_SUPABASE_PUBLISHABLE_KEY"), file=sys.stderr)
        print("Workflow variable key: " + shape(expected_key), file=sys.stderr)
        fail("Frontend Supabase publishable key mismatch")
    if not expected_url.startswith("https://") or not expected_key.startswith("sb_publishable_"):
        fail("Expected Supabase configuration is invalid")
    if required(backend, "SUPABASE_ISSUER") != expected_url + "/auth/v1":
        fail("Supabase issuer mismatch")
    if required(backend, "SUPABASE_JWKS_URL") != expected_url + "/auth/v1/.well-known/jwks.json":
        fail("Supabase JWKS mismatch")
    if required(backend, "SUPABASE_AUDIENCE") != "authenticated":
        fail("Supabase audience mismatch")
    if required(backend, "CORS_ORIGINS") != "https://" + hostname:
        fail("CORS origin mismatch")
    if required(backend, "NODE_ENV") != "production" or required(backend, "TRUST_PROXY_HOPS") != "1":
        fail("Production security configuration mismatch")
    if required(backend, "HOST") != "0.0.0.0" or required(backend, "PORT") != "4000":
        fail("Private API listener configuration mismatch")
    password = required(public, "POSTGRES_PASSWORD")
    db_url = urlparse(required(backend, "DATABASE_URL"))
    if db_url.scheme != "postgresql" or db_url.hostname != "db" or db_url.port != 5432:
        fail("Database URL must target the private Compose database")
    if unquote(db_url.username or "") != required(public, "POSTGRES_USER"):
        fail("Database user mismatch")
    if unquote(db_url.password or "") != password:
        fail("Database password mismatch")
    if db_url.path.lstrip("/") != required(public, "POSTGRES_DB"):
        fail("Database name mismatch")
    if required(public, "POSTGRES_DB") == "postgres":
        fail("Do not use the default postgres database")
except (KeyError, OSError, ValueError) as error:
    print(f"Release environment check failed: {error}", file=sys.stderr)
    sys.exit(1)

print("Release environment check passed")
