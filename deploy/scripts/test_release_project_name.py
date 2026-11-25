"""The release must keep the approved Compose volume identity."""
import os
import subprocess
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("release-ghcr.sh")


class ProjectIdentityTests(unittest.TestCase):
    def run_release(self, name):
        env = dict(os.environ)
        env.update(
            COMPOSE_PROJECT_NAME=name,
            DEPLOY_ENV_FILE="/nonexistent/compose.env",
            BACKEND_ENV_FILE="/nonexistent/backend.env",
            MIGRATIONS_REVIEWED_SHA="0" * 40,
            INITIAL_EMPTY_DB="true",
            RELEASE_STATE_DIR="/nonexistent/state",
        )
        return subprocess.run(
            [os.environ.get("BASH", "bash"), str(SCRIPT)], env=env, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
        )

    def test_approved_name_passes_identity_gate(self):
        result = self.run_release("kaamdham-beta")
        self.assertNotIn("Compose project identity", result.stderr)
        # The isolated test has no Git checkout or deployment credentials.
        self.assertNotEqual(result.returncode, 0)

    def test_empty_name_fails_closed(self):
        result = self.run_release("")
        self.assertEqual(result.returncode, 2)
        self.assertIn("identity missing (bytes=0)", result.stderr)

    def test_trailing_whitespace_fails_closed(self):
        result = self.run_release("kaamdham-beta ")
        self.assertEqual(result.returncode, 2)
        self.assertIn("character_class=whitespace", result.stderr)

    def test_carriage_return_fails_closed(self):
        result = self.run_release("kaamdham-beta\r")
        self.assertEqual(result.returncode, 2)
        self.assertIn("character_class=whitespace", result.stderr)

    def test_unicode_dash_fails_closed(self):
        result = self.run_release("kaamdham‑beta")
        self.assertEqual(result.returncode, 2)
        self.assertIn("character_class=non_ascii", result.stderr)

    def test_other_valid_compose_name_cannot_change_volume(self):
        result = self.run_release("other-beta")
        self.assertEqual(result.returncode, 2)
        self.assertIn("character_class=other", result.stderr)


if __name__ == "__main__":
    unittest.main()
