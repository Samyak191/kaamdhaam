"""Release environment validation must fail closed and explain key mismatches without leaking values."""
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("validate-env.py")
URL = "https://tvynmgcbyathsgguezye.supabase.co"
HOST = "kaam-dhaam.in"
KEY = "sb_publishable_test0123456789abcdefghijklmn"
PASSWORD = "synthetic-test-password"

COMPOSE = (
    "POSTGRES_DB=kaamdham\nPOSTGRES_USER=kaamdham\nPOSTGRES_PASSWORD={password}\nHTTP_PORT=8080\n"
    "STAGING_HOST={host}\nVITE_SUPABASE_URL={url}\nVITE_SUPABASE_PUBLISHABLE_KEY={key}{tail}\n"
)
BACKEND = (
    "NODE_ENV=production\nHOST=0.0.0.0\nPORT=4000\n"
    "DATABASE_URL=postgresql://kaamdham:{password}@db:5432/kaamdham?schema=public\n"
    "CORS_ORIGINS=https://{host}\nTRUST_PROXY_HOPS=1\nSUPABASE_ISSUER={url}/auth/v1\n"
    "SUPABASE_JWKS_URL={url}/auth/v1/.well-known/jwks.json\nSUPABASE_AUDIENCE=authenticated\n"
)


class ValidateEnvTests(unittest.TestCase):
    def run_validator(self, file_key, expected_key, tail=""):
        with tempfile.TemporaryDirectory() as directory:
            compose = Path(directory, "compose.env")
            backend = Path(directory, "backend.env")
            compose.write_bytes(COMPOSE.format(password=PASSWORD, host=HOST, url=URL, key=file_key, tail=tail).encode())
            backend.write_bytes(BACKEND.format(password=PASSWORD, host=HOST, url=URL).encode())
            env = dict(os.environ)
            env.update(
                DEPLOY_ENV_FILE=str(compose),
                BACKEND_ENV_FILE=str(backend),
                STAGING_HOST=HOST,
                EXPECTED_SUPABASE_URL=URL,
                EXPECTED_SUPABASE_PUBLISHABLE_KEY=expected_key,
            )
            return subprocess.run(
                [sys.executable, str(SCRIPT)], env=env, text=True,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
            )

    def test_matching_configuration_passes(self):
        result = self.run_validator(KEY, KEY)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Release environment check passed", result.stdout)

    def test_mismatch_reports_shape_without_values(self):
        other = KEY[:-1] + "z"
        result = self.run_validator(KEY, other + " ")
        self.assertEqual(result.returncode, 1)
        self.assertIn("Frontend Supabase publishable key mismatch", result.stderr)
        self.assertIn("Server file key: chars=%d" % len(KEY), result.stderr)
        self.assertIn("Workflow variable key: chars=%d" % (len(other) + 1), result.stderr)
        self.assertIn("outer_whitespace", result.stderr)
        for secret in (KEY, other, PASSWORD):
            self.assertNotIn(secret, result.stdout + result.stderr)

    def test_file_trailing_carriage_return_is_reported(self):
        result = self.run_validator(KEY, KEY[:-1] + "z", tail="\r")
        self.assertEqual(result.returncode, 1)
        self.assertIn("trailing_cr=True", result.stderr)
        self.assertNotIn(KEY, result.stdout + result.stderr)

    def test_file_trailing_carriage_return_still_matches_parsed_value(self):
        # read_env strips the line, so a CR alone does not cause a mismatch.
        result = self.run_validator(KEY, KEY, tail="\r")
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
