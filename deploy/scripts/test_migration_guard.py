"""Destructive migration detection and history tamper checks for the release guard."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("migration-guard.py")
MIGRATIONS = "backend/prisma/migrations"


class MigrationGuardTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name)
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "ci@example.invalid")
        self.git("config", "user.name", "ci")
        self.git("config", "commit.gpgsign", "false")
        self.write(f"{MIGRATIONS}/0001_init/migration.sql", 'CREATE TABLE "users" ("id" TEXT PRIMARY KEY);\n')
        self.base = self.commit("base")

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        return subprocess.run(["git", "-C", str(self.repo), *args], check=True, text=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout.strip()

    def write(self, rel, content):
        path = self.repo / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def commit(self, message):
        self.git("add", "-A")
        self.git("commit", "-q", "-m", message)
        return self.git("rev-parse", "HEAD")

    def guard(self, previous, release, reviewed="false", initial_empty="false"):
        return subprocess.run([sys.executable, str(SCRIPT), "--repo", str(self.repo), "--previous", previous,
                               "--release", release, "--reviewed", reviewed, "--initial-empty-db", initial_empty],
                              text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)

    def test_no_new_migrations_is_safe(self):
        self.write("README.md", "x\n")
        release = self.commit("docs")
        result = self.guard(self.base, release)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("no new migrations", result.stdout)

    def test_additive_migration_is_safe(self):
        self.write(f"{MIGRATIONS}/0002_add/migration.sql",
                   '-- AlterTable\nALTER TABLE "users" ADD COLUMN "bio" TEXT;\n'
                   'CREATE INDEX "users_bio_idx" ON "users"("bio");\nDROP INDEX "old_idx";\n')
        release = self.commit("add column")
        result = self.guard(self.base, release)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("additive", result.stdout)

    def test_drop_column_requires_review(self):
        self.write(f"{MIGRATIONS}/0002_drop/migration.sql",
                   "/*\n  Warnings:\n\n  - You are about to drop the column `bio` on the `users` table.\n*/\n"
                   'ALTER TABLE "users" DROP COLUMN "bio";\n')
        release = self.commit("drop column")
        result = self.guard(self.base, release)
        self.assertEqual(result.returncode, 3)
        self.assertIn("prisma_warnings_header", result.stdout)
        self.assertIn("drop_column", result.stdout)
        self.assertIn("destructive_migrations_reviewed=true", result.stderr)
        reviewed = self.guard(self.base, release, reviewed="true")
        self.assertEqual(reviewed.returncode, 0, reviewed.stderr)

    def test_comment_mentions_do_not_count_as_statements(self):
        self.write(f"{MIGRATIONS}/0002_safe/migration.sql",
                   '-- We deliberately do not DROP TABLE here\nALTER TABLE "users" ADD COLUMN "city" TEXT;\n')
        release = self.commit("safe")
        self.assertEqual(self.guard(self.base, release).returncode, 0)

    def test_type_change_and_data_rewrite_require_review(self):
        self.write(f"{MIGRATIONS}/0002_type/migration.sql",
                   'ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE INTEGER;\nUPDATE "users" SET "id" = 1;\n')
        release = self.commit("type change")
        result = self.guard(self.base, release)
        self.assertEqual(result.returncode, 3)
        self.assertIn("alter_column_type", result.stdout)
        self.assertIn("update", result.stdout)

    def test_modified_applied_migration_fails_even_when_reviewed(self):
        self.write(f"{MIGRATIONS}/0001_init/migration.sql",
                   'CREATE TABLE "users" ("id" TEXT PRIMARY KEY, "x" TEXT);\n')
        release = self.commit("edit applied migration")
        result = self.guard(self.base, release, reviewed="true")
        self.assertEqual(result.returncode, 2)
        self.assertIn("modified or deleted", result.stderr)

    def test_unknown_previous_requires_manual_review_unless_initial_empty(self):
        self.assertEqual(self.guard("", self.base).returncode, 3)
        self.assertEqual(self.guard("", self.base, reviewed="true").returncode, 0)
        self.assertEqual(self.guard("", self.base, initial_empty="true").returncode, 0)

    def test_malformed_sha_fails_closed(self):
        self.assertEqual(self.guard("abc", self.base).returncode, 2)
        self.assertEqual(self.guard(self.base, self.base.upper()).returncode, 2)


if __name__ == "__main__":
    unittest.main()
