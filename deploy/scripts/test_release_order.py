"""Release ordering and trigger provenance gates in release-ghcr.sh.

Runs the script from a throwaway Git repository that contains only the release scripts, so
every case stops before any Docker or server access. The ordering guard must skip older
commits, accept descendants, and fail closed on unknown history or an automatic trigger that
tries to initialise an empty database.
"""
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
BASH = os.environ.get("BASH", "bash")


class ReleaseOrderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name) / "repo"
        self.state = Path(self.tmp.name) / "state"
        self.state.mkdir()
        (self.repo / "deploy" / "scripts").mkdir(parents=True)
        for name in ("release-ghcr.sh", "migration-guard.py"):
            shutil.copy(SCRIPTS / name, self.repo / "deploy" / "scripts" / name)
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "ci@example.invalid")
        self.git("config", "user.name", "ci")
        self.git("config", "commit.gpgsign", "false")
        self.git("config", "core.autocrlf", "false")
        self.older = self.commit("older")
        self.newer = self.commit("newer")

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        return subprocess.run(["git", "-C", str(self.repo), *args], check=True, text=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout.strip()

    def commit(self, message):
        (self.repo / "VERSION").write_text(message + "\n", encoding="utf-8")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", message)
        return self.git("rev-parse", "HEAD")

    def release(self, head, deployed=None, trigger="workflow_run", initial_empty="false", reviewed="false"):
        self.git("checkout", "-q", head)
        current = self.state / "current"
        if deployed is None:
            if current.exists():
                current.unlink()
        else:
            current.write_text(deployed + "\n", encoding="utf-8")
        env = dict(os.environ)
        env.update(
            COMPOSE_PROJECT_NAME="kaamdham-beta",
            DEPLOY_ENV_FILE="/nonexistent/compose.env",
            BACKEND_ENV_FILE="/nonexistent/backend.env",
            MIGRATIONS_REVIEWED_SHA=head,
            INITIAL_EMPTY_DB=initial_empty,
            RELEASE_STATE_DIR=str(self.state),
            RELEASE_TRIGGER=trigger,
            DESTRUCTIVE_MIGRATIONS_REVIEWED=reviewed,
        )
        env.pop("GITHUB_OUTPUT", None)
        return subprocess.run([BASH, str(self.repo / "deploy" / "scripts" / "release-ghcr.sh")], env=env,
                              text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)

    def test_older_commit_is_skipped_not_deployed(self):
        result = self.release(self.older, deployed=self.newer)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("older than the deployed", result.stdout)
        self.assertNotIn("Migration guard", result.stdout)

    def test_descendant_passes_ordering_and_migration_guard(self):
        result = self.release(self.newer, deployed=self.older)
        self.assertIn("descends from the deployed", result.stdout)
        self.assertIn("no new migrations", result.stdout)
        # The isolated repository has no server environment, so the release must still stop later.
        self.assertNotEqual(result.returncode, 0)

    def test_same_commit_is_reverified(self):
        result = self.release(self.newer, deployed=self.newer)
        self.assertIn("already the recorded deployment", result.stdout)
        self.assertNotEqual(result.returncode, 0)

    def test_unknown_deployed_commit_fails_closed(self):
        result = self.release(self.newer, deployed="f" * 40)
        self.assertEqual(result.returncode, 2)
        self.assertIn("absent from the release checkout history", result.stderr)

    def test_malformed_state_fails_closed(self):
        result = self.release(self.newer, deployed="not-a-sha")
        self.assertEqual(result.returncode, 2)
        self.assertIn("malformed", result.stderr)

    def test_automatic_trigger_cannot_initialise_empty_database(self):
        result = self.release(self.newer, deployed=self.older, initial_empty="true")
        self.assertEqual(result.returncode, 2)
        self.assertIn("never initialise an empty database", result.stderr)

    def test_automatic_trigger_cannot_self_approve_destructive_migrations(self):
        result = self.release(self.newer, deployed=self.older, reviewed="true")
        self.assertEqual(result.returncode, 2)
        self.assertIn("cannot carry a destructive-migration review", result.stderr)

    def test_missing_state_without_review_requires_manual_release(self):
        result = self.release(self.newer, deployed=None)
        self.assertEqual(result.returncode, 3)
        self.assertIn("destructive_migrations_reviewed=true", result.stderr)

    def test_unknown_trigger_fails_closed(self):
        result = self.release(self.newer, deployed=self.older, trigger="schedule")
        self.assertEqual(result.returncode, 2)
        self.assertIn("RELEASE_TRIGGER", result.stderr)


if __name__ == "__main__":
    unittest.main()
