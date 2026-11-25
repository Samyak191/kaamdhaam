#!/usr/bin/env python3
"""Block automatic releases that add unreviewed destructive Prisma migrations.

Compares the migrations directory between the currently deployed commit and the release
commit. New migration SQL that can lose data (DROP TABLE/COLUMN/SCHEMA/TYPE, TRUNCATE, DELETE,
UPDATE, column type changes, NOT NULL tightening, renames, or a Prisma "Warnings" header)
requires an explicit manual review flag. Editing or deleting an already-shipped migration
always fails: ``prisma migrate deploy`` refuses checksum changes and the history could no
longer be trusted.

Exit codes: 0 safe, 2 invalid input or tampered history, 3 destructive migration not reviewed.
Only file names and statement categories are printed; SQL contents never are.
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

MIGRATIONS_DIR = "backend/prisma/migrations"
DESTRUCTIVE_PATTERNS = {
    "drop_table": re.compile(r"\bDROP\s+TABLE\b", re.I),
    "drop_column": re.compile(r"\bDROP\s+COLUMN\b", re.I),
    "drop_schema": re.compile(r"\bDROP\s+(SCHEMA|DATABASE)\b", re.I),
    "drop_type": re.compile(r"\bDROP\s+TYPE\b", re.I),
    "truncate": re.compile(r"\bTRUNCATE\b", re.I),
    "delete": re.compile(r"\bDELETE\s+FROM\b", re.I),
    "update": re.compile(r"\bUPDATE\s+\S+\s+SET\b", re.I),
    "alter_column_type": re.compile(r"\bALTER\s+COLUMN\b[^;]*\b(SET\s+DATA\s+)?TYPE\b", re.I | re.S),
    "set_not_null": re.compile(r"\bALTER\s+COLUMN\b[^;]*\bSET\s+NOT\s+NULL\b", re.I | re.S),
    "rename": re.compile(r"\bRENAME\s+(TO|COLUMN)\b", re.I),
}
WARNINGS_HEADER = re.compile(r"^\s*Warnings:\s*$", re.I | re.M)
SHA = re.compile(r"^[a-f0-9]{40}$")


def strip_sql_comments(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    return re.sub(r"--[^\n]*", " ", sql)


def classify(sql: str) -> list[str]:
    reasons = []
    if WARNINGS_HEADER.search(sql):
        reasons.append("prisma_warnings_header")
    body = strip_sql_comments(sql)
    reasons.extend(name for name, pattern in DESTRUCTIVE_PATTERNS.items() if pattern.search(body))
    return reasons


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *args], check=True, text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout


def changed_migrations(repo: Path, previous: str, release: str) -> list[tuple[str, str]]:
    output = git(repo, "diff", "--name-status", "--no-renames", previous, release, "--", MIGRATIONS_DIR)
    entries = []
    for line in output.splitlines():
        status, _, path = line.partition("\t")
        if path:
            entries.append((status[:1], path))
    return entries


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--release", required=True, help="full release commit SHA")
    parser.add_argument("--previous", default="", help="currently deployed SHA; empty if unknown")
    parser.add_argument("--reviewed", choices=["true", "false"], required=True,
                        help="a human reviewed destructive migrations for this release")
    parser.add_argument("--initial-empty-db", choices=["true", "false"], default="false")
    args = parser.parse_args()
    repo = Path(args.repo)
    if not SHA.match(args.release) or (args.previous and not SHA.match(args.previous)):
        print("Migration guard: release and previous SHAs must be full lowercase hex", file=sys.stderr)
        return 2

    if args.initial_empty_db == "true":
        print("Migration guard: initial empty database approved manually; no existing data to protect")
        return 0
    if not args.previous:
        if args.reviewed == "true":
            print("Migration guard: no recorded deployed commit; proceeding on explicit manual review")
            return 0
        print("Migration guard: no recorded deployed commit, so new migrations cannot be diffed. "
              "Run a manual deployment with destructive_migrations_reviewed=true after review.", file=sys.stderr)
        return 3

    try:
        git(repo, "cat-file", "-e", f"{args.previous}^{{commit}}")
        git(repo, "cat-file", "-e", f"{args.release}^{{commit}}")
        entries = changed_migrations(repo, args.previous, args.release)
    except subprocess.CalledProcessError as error:
        print(f"Migration guard: git history unavailable ({error.stderr.strip() or 'unknown error'})", file=sys.stderr)
        return 2

    tampered = [p for s, p in entries if s in {"M", "D"} and p.endswith(".sql")]
    if tampered:
        print("Migration guard: applied migrations were modified or deleted; refusing to deploy:", file=sys.stderr)
        for path in tampered:
            print(f"  {path}", file=sys.stderr)
        return 2

    added = [p for s, p in entries if s == "A" and p.endswith(".sql")]
    if not added:
        print("Migration guard: no new migrations since the deployed commit")
        return 0

    destructive = {}
    for path in added:
        try:
            sql = git(repo, "show", f"{args.release}:{path}")
        except subprocess.CalledProcessError:
            print(f"Migration guard: cannot read {path} at the release commit", file=sys.stderr)
            return 2
        reasons = classify(sql)
        if reasons:
            destructive[path] = reasons
    print(f"Migration guard: {len(added)} new migration file(s) since the deployed commit")
    for path in added:
        label = "DESTRUCTIVE " + ",".join(destructive[path]) if path in destructive else "additive"
        print(f"  {path}: {label}")
    if destructive and args.reviewed != "true":
        print("Migration guard: destructive migrations require a manual deployment with "
              "destructive_migrations_reviewed=true after a schema and backup review.", file=sys.stderr)
        return 3
    if destructive:
        print("Migration guard: destructive migrations accepted on explicit manual review")
    return 0


if __name__ == "__main__":
    sys.exit(main())
