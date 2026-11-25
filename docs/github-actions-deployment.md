# GitHub Actions to existing Sydney EC2: release procedure

This is the current CI/CD procedure for the **existing** `ap-southeast-2` Amazon Linux 2023 `t3.small` host and its `kaamdhaam-ec2-runner`. It replaces the older Mumbai/t3.medium *provisioning proposal* for deployment purposes. No new EC2, IAM, bucket, DNS, or Supabase resource is created by this repository change. The host serves `https://kaam-dhaam.in`; see [Automatic releases](#automatic-releases-enabled-25-november-2026) for the push-to-deploy flow.

## Pipeline and safety boundary

```mermaid
flowchart LR
  Push[Push to main] --> Tests[Hosted backend + frontend CI]
  Tests --> Publish[Hosted GHCR builds: migrate, backend, web]
  Dispatch[Manual Deploy staging on main] --> Verify[Hosted GHCR image verification]
  Publish --> Verify
  Verify --> Runner[Sydney self-hosted runner]
  Runner --> Preflight[Env, DNS, RAM, disk, Caddy, S3 role]
  Preflight --> Database[Persistent PostgreSQL]
  Database --> Backup[Encrypted backup if data exists]
  Backup --> Migrate[Prisma migrate deploy]
  Migrate --> App[Backend + web + Caddy]
  App --> Smoke[HTTPS health + revision checks]
```

`.github/workflows/ci.yml` keeps all existing backend/frontend checks and audits on GitHub-hosted Ubuntu. After both pass on `main`, a hosted job publishes three GHCR images, each tagged with the full Git commit SHA: `ghcr.io/samyak191/kaamdhaam-migrate:<sha>`, `...-backend:<sha>`, and `...-web:<sha>`. The web build fixes `VITE_APP_MODE=live` and `VITE_API_BASE_URL=/v1`. The dedicated KaamDhaam Supabase URL and its *public* publishable key are build inputs; Vite embeds them in browser code. No service-role key or database secret enters an image. OCI revision/source labels identify each image.

Only `.github/workflows/deploy.yml` has a self-hosted job. It is triggered by `workflow_dispatch` with `deploy_to_ec2=true` on `main`. A GitHub-hosted job first verifies that the successful push already published all three commit images; manual deployment does not rebuild or replace tags. The deploy job selects labels `self-hosted`, `Linux`, `X64`, `kaamdhaam-deploy` and checks the exact runner name. The committed CI workflow's pull-request jobs use hosted runners only. A deployment concurrency group never cancels an active release. The deploy job needs `packages:read` and uses a temporary Docker credential directory; the hosted publish job alone has `packages:write`. The built-in `GITHUB_TOKEN` is sufficient if GHCR packages grant this repository access. No long-lived GitHub or AWS key is required. An optional `staging` environment can add reviewer protection if the repository plan supports it; manual dispatch is the first-release gate even without that feature. Later automatic deployment can add a trusted-main completion trigger and SHA selection to this separate deploy workflow without changing the release scripts.

**Runner isolation setting is required:** if this repository accepts untrusted pull requests, YAML alone cannot stop a PR from proposing a modified CI workflow that targets a repository-level self-hosted runner. Before relying on this runner, restrict its runner group to the `deploy.yml` workflow if the account supports that setting, or otherwise prevent untrusted PR workflows from accessing this runner (for example, use a private repository with controlled collaborators). Verify the actual repository/runner policy in GitHub settings before first deployment. [GitHub's runner security guidance](https://docs.github.com/en/actions/reference/security/secure-use) warns that persistent self-hosted runners are unsafe for untrusted public PR code.

## Configuration before the first manual deployment

### Fast track for the existing Sydney host

Use `deploy/scripts/bootstrap-existing-ec2.sh` in an approved Session Manager terminal after this commit is pushed. It is for the already provisioned Amazon Linux 2023 server; `bootstrap-al2023.sh` is the earlier OS/Docker installation script and is unnecessary here. From a trusted checkout of the intended release, run:

```bash
systemctl list-units --all 'actions.runner*' --no-pager
systemctl show -p User --value <actual-runner-unit-name>
sudo bash deploy/scripts/bootstrap-existing-ec2.sh <actual-runner-service-user>
```

Use the unit name and service account reported on the host. If `User` is empty, inspect the unit and pass its actual service account explicitly; do not guess. The script checks Docker access as that user, Python, AWS CLI, disk (at least 6 GiB free), total/available RAM (at least 1.8 GiB/512 MiB), and the existing database volume. It prompts privately for the dedicated Supabase URL and publishable key, generates a random PostgreSQL password **only when both server env files and the project database volume are absent**, and creates root-owned, runner-group-readable env files. Existing files and volumes are left in place. It validates their contents and merged Compose configuration without pulling images or starting containers. The password is not printed or stored in Git. Back up these env files through an approved encrypted process before treating host loss as recoverable. If the volume already exists but env files do not, recover its original credentials rather than generating new ones.

The script's Git checkout must be the same reviewed commit that will be dispatched, because `ghcr.compose.yaml` uses its full SHA. It checks that the runner account can inspect all three published GHCR manifests. `verify_images` repeats that check on a hosted runner, and the deploy job uses its short-lived `GITHUB_TOKEN` for an authenticated pull. No personal access token belongs on EC2. The published app images are prebuilt; the only on-host build on later releases is the small `age` backup helper when an existing database requires backup. A 2 GiB host passes only a minimum headroom check, not a capacity guarantee; measure memory and restart counts after the first release.

Before the first dispatch, set `AGE_RECIPIENT` to a public age recipient and `BACKUP_S3_URI` to the real approved `s3://<bucket>/backups` prefix as GitHub Actions variables. Keep the age private identity off EC2. The instance profile must allow `s3:ListBucket` for `backups/*` and `s3:PutObject` plus `s3:GetObject` for `backups/*`; the upload uses SSE-S3 (`AES256`). A successful `ListBucket` preflight does **not** prove upload works. After approval, test an encrypted backup object upload, checksum retrieval, and restore to an isolated database before treating off-host backup as verified. Do not name a bucket until its actual destination and access are confirmed.

While `.IN` KYC or DNS is pending, bootstrap and Compose config checks may run over Session Manager; container startup and the manual deploy stay blocked. `preflight-ec2.sh` requires `staging.kaam-dhaam.in` to resolve to `3.104.58.162` before Compose starts, and `smoke.sh` requires trusted HTTPS. A local or private-network HTTP check can diagnose a running service later, but cannot satisfy public staging acceptance. Confirm Supabase Site URL and redirect allowlist use the final HTTPS host.

The checked-in workflows send all pull-request jobs to GitHub-hosted runners, and only the manual `main` deployment uses the `kaamdhaam-deploy` runner. Verify its runner group/workflow access in GitHub settings: untrusted contributors must not be able to run altered PR workflows on it. Docker group access on this runner is effectively host administrator access.

Create repository **Actions variables** (public configuration, never passwords):

| Variable | Required value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://tvynmgcbyathsgguezye.supabase.co` (dedicated KaamDhaam project only) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | This same project's publishable key; it is intentionally public in the web bundle |
| `COMPOSE_PROJECT_NAME` | Optional diagnostic variable. The deployment workflow pins the approved name `kaamdham-beta`; this variable cannot change the PostgreSQL volume identity. If present, set it to exactly `kaamdham-beta`. |
| `STAGING_HOST` | Approved DNS hostname pointing to this EC2; no URL scheme or path |
| `EXPECTED_PUBLIC_IPV4` | This EC2's approved public IPv4; preflight compares DNS |
| `AGE_RECIPIENT` | Public age recipient whose private identity is held off-host |
| `BACKUP_S3_URI` | Approved `s3://<bucket>/backups` prefix accessible via the EC2 instance role |

No custom GitHub Actions secret is required. Do not add AWS access keys, PostgreSQL passwords, private age identity, Supabase service-role keys, or JWT tokens to repository variables or workflow files. The runner must use its EC2 IAM instance role for the backup bucket. GHCR packages must allow repository Actions read access; verify package access after first publish. Protect `main` and limit who can run the manual deployment workflow.

On the EC2 host, prepare the following **before clicking Run workflow**:

1. `/etc/kaamdhaam/compose.env`, readable by the runner and mode `0600` or `0640`, based on `deploy/.env.example`. Fill `POSTGRES_DB`, `POSTGRES_USER`, a unique `POSTGRES_PASSWORD`, `STAGING_HOST`, and the exact dedicated `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`. Add `BACKEND_ENV_FILE=/etc/kaamdhaam/backend.env`. If the host already has a KaamDhaam database, retain its **actual existing** database name, user and password; never change them to match an example.
2. `/etc/kaamdhaam/backend.env`, also mode `0600` or `0640`, based on `deploy/backend.env.example`. Set `DATABASE_URL=postgresql://<user>:<URL-encoded-password>@db:5432/<db>?schema=public`, `CORS_ORIGINS=https://<staging-host>`, `NODE_ENV=production`, `TRUST_PROXY_HOPS=1`, and the matching Supabase issuer/JWKS. Do not use a service-role key or a symmetric JWT secret; the API verifies the dedicated project's JWKS.
3. `/opt/kaamdhaam/state`, owned and writable by the runner service account. The release records `current` and `previous` verified commit SHAs here only after health checks pass. Keep this directory across checkouts.
4. `/opt/kaamdhaam/backups`, owned by the runner service account with mode `0700`. Pre-migration encrypted backups are written here (`BACKUP_OUTPUT_DIR` in `deploy.yml`) before upload; preflight refuses to start if it is absent or not writable.
5. DNS A record points to the approved EC2 public IP; 80/443 can reach Caddy, while 22, 4000, 5432 and 8080 are not publicly open. Verify Caddy configuration, TLS hostname ownership, Supabase Site URL and exact redirect allowlist for `/login`, `/onboarding`, `/reset-password`, and the instance-role-only S3 backup prefix. The first trusted certificate is issued when Caddy starts; the post-start smoke check must verify HTTPS before the release is accepted.
6. Confirm at least 6 GiB free in Docker's filesystem and at least 512 MiB available RAM on the 2 GiB host. The workflow **pulls** app images; it does not build them there. The age helper is a small local backup image. Monitor memory and disk after release; `t3.small` headroom remains an operational risk.
7. Review pending Prisma SQL migrations. Confirm the database volume's current state, backup recipient/key custody, and S3 restore access. The fixed approved project name is `kaamdham-beta`, so the volume is `kaamdham-beta_postgres_data`. Never run `down -v`, `migrate reset`, or `db push`.

The `preflight-ec2.sh` script checks env consistency without printing values, file permissions, DNS, resource headroom, Caddy config, and IAM-role S3 access **before any Compose operation**. `ghcr.compose.yaml` removes all app build contexts from Compose. An existing database volume always gets an encrypted S3 backup before `prisma migrate deploy`. If no volume exists, the manual `initial_empty_db=true` input explicitly authorizes creating a new empty database. A mismatch stops the release. Compose then waits for database health, the one-shot migration's successful completion, and backend/web health. HTTPS smoke and running revision labels must pass before recording the release as verified.

### Manual first release

After the CI/CD commit is pushed **with separate user approval**, let the automatic `main` CI and GHCR publish jobs pass. In GitHub Actions, run **Deploy staging** on `main` with `deploy_to_ec2=true`, `reviewed_sha` equal to the displayed full 40-character commit SHA, and `initial_empty_db=true` **only if no KaamDhaam PostgreSQL volume exists**. Otherwise choose false. The hosted verification job checks that the existing SHA-tagged images are available before the gated EC2 job starts. Do not start it while any prerequisite above is unverified. The workflow fails closed on missing variables/files, image tags, backup access, disk/RAM, migration failure or HTTPS health failure.

## Automatic releases (enabled 25 November 2026)

The first manual release of commit `26ac4935b55a799cae6e7cf293c1789c074a0dbb` succeeded on 24 November 2026 and the site serves `https://kaam-dhaam.in` (the `staging` labels in the workflow and environment are historical). From this commit on, **a push to `main` updates the live site without any manual GitHub Actions step**:

```mermaid
flowchart LR
  Push[Push to main] --> CI[CI: backend, frontend, release tooling]
  CI --> Publish[GHCR images tagged with the commit SHA]
  Publish -->|workflow_run success| Gate[Hosted gate: trusted trigger, commit on main, images exist]
  Gate --> Runner[Sydney runner: checkout exact SHA]
  Runner --> Order[Ordering guard against /opt/kaamdhaam/state/current]
  Order --> Guard[Migration guard: additive only]
  Guard --> Preflight[Env, DNS, RAM, disk, Caddy, S3 role]
  Preflight --> Backup[Encrypted backup, verified in S3]
  Backup --> Migrate[prisma migrate deploy]
  Migrate --> Smoke[HTTPS routes, API health, headers, certificate, revisions]
  Smoke --> Record[state/current = SHA]
```

**Trigger trust.** `deploy.yml` listens for `workflow_run` completions of `CI`. GitHub always runs a `workflow_run` workflow from the default branch's copy of the file, so a pull request cannot edit the deployment workflow it triggers. The `gate` job starts only when the CI run **succeeded**, was a **`push`** event, its head branch is **`main`**, and its head repository is this repository (forks and pull-request CI runs never match). The same conditions are re-tested in the shell, and the hosted gate then checks that the commit is reachable from `origin/main` and that all three `ghcr.io/samyak191/kaamdhaam-{migrate,backend,web}:<sha>` images exist. Only then does the self-hosted job start, checking out exactly that SHA with full history.

**Ordering.** CI runs can finish out of order. On the host, `release-ghcr.sh` compares the candidate with `/opt/kaamdhaam/state/current`: a candidate that is an ancestor of the deployed commit is **skipped** (the run reports `outcome=superseded` and exits successfully without touching containers); a descendant proceeds; the same commit is re-verified; unknown or diverged history fails closed. The workflow-level `kaamdhaam-ec2-deploy` concurrency group never cancels a running release and keeps only the newest queued one.

**Database protection.** The automatic path hard-codes `INITIAL_EMPTY_DB=false` and `DESTRUCTIVE_MIGRATIONS_REVIEWED=false`; the release script independently rejects any `workflow_run` release that carries either flag as `true`. An existing `kaamdham-beta_postgres_data` volume is required, an encrypted backup is uploaded and read back from S3 before `prisma migrate deploy`, and `migration-guard.py` diffs `backend/prisma/migrations` between the deployed and candidate commits. New SQL containing `DROP TABLE/COLUMN/SCHEMA/TYPE`, `TRUNCATE`, `DELETE`, `UPDATE`, column type changes, `SET NOT NULL`, renames, or a Prisma `Warnings:` header stops the automatic release with exit code 3; a modified or deleted already-applied migration always fails (exit 2). CI runs the same guard over the full history and emits a warning on the commit that introduces a destructive migration, so you learn before the deploy stops.

**Shipping a destructive migration.** Review the SQL and the data impact, confirm a fresh backup and an isolated restore test, then run **Deploy staging** manually on `main` with `deploy_to_ec2=true`, `reviewed_sha=<full SHA>`, `initial_empty_db=false`, `destructive_migrations_reviewed=true`. Manual dispatch is also the recovery path if the automatic release is ever disabled; it goes through the identical gate, ordering and backup steps.

**Health verification.** A release is recorded only after `smoke.sh` passes over public HTTPS: `/`, `/login`, `/signup`, `/jobs`, `/talent`, `/reset-password`, `/v1/health` (body `status: ok`) and `/v1/ready` all return 200, `nosniff` and HSTS headers are present, the certificate is trusted and valid for at least 14 more days, and the running `backend`/`web` containers carry the release SHA in their revision label. The workflow repeats the smoke test after the script and prints `release-status.sh` (container state, health, restart counts, revisions, volume, disk, redacted logs) on success and failure. The job summary shows trigger, candidate, outcome and the recorded live commit.

### Required GitHub settings (cannot be expressed in YAML)

These are repository settings; verify them in the GitHub UI because the runner has Docker access on the production host:

1. **Ruleset on `main`**: block force pushes and restrict deletions (minimum). The ordering guard refuses rewritten history, so a force push would stop automatic releases until resolved manually. Add "Require status checks" (`backend`, `frontend`, `release_tooling`) and "Require a pull request" only when changes arrive through pull requests; required checks reject direct pushes of new commits. CI already gates every deployment regardless.
2. **Actions → General → Fork pull request workflows**: set "Require approval for all outside collaborators" (the public repository default only covers first-time contributors). Never approve a fork workflow run that changes `runs-on` to the self-hosted labels.
3. **Actions → General → Workflow permissions**: "Read repository contents and packages permissions"; leave "Allow GitHub Actions to create and approve pull requests" off.
4. **Environment `staging`**: add a deployment branch policy allowing only `main`. Do not add required reviewers unless you want every automatic release to wait for a click.
5. **Runner**: repository-level runners cannot be restricted per workflow. If outside contributors are ever granted write access, move the runner to an organisation runner group restricted to this repository, or make the repository private. Until then, every account with write access can run code on the EC2 host by pushing to `main`.
6. **GHCR packages**: keep the three packages linked to the repository with Actions read access; the deploy job uses only the short-lived `GITHUB_TOKEN`.

### Rollback

`/opt/kaamdhaam/state/previous` records the prior verified SHA. First inspect schema compatibility with that image; Prisma migrations are **never** reversed automatically. On the server, authenticate GHCR with a temporary read token, set `RELEASE_GIT_SHA` to the prior SHA, `BACKEND_ENV_FILE=/etc/kaamdhaam/backend.env`, and `STAGING_HOST` to the approved hostname. From a trusted checkout, use the **same** Compose project name, three Compose files and `/etc/kaamdhaam/compose.env` to pull and start the prior images with `--no-build --wait`. Confirm `/v1/ready`, HTTPS routes, and image revision labels before updating the verified state record. Preserve the existing PostgreSQL volume. Restore a backup only to a separate database/host after reviewing data recovery needs. Do not guess the previous SHA from `latest` tags; this pipeline publishes SHA tags only.

## What remains unverified locally

GHCR publication, runner package permission, EC2 environment, IAM role, DNS, certificate issuance, PostgreSQL migration against live data, S3 backup upload, and end-to-end staging acceptance require the manually approved release. Local checks can validate workflow syntax, Compose merge, preflight logic, tests and image builds without contacting EC2. No workflow runs on the server until the approved code is pushed and the manual deployment is triggered.

Local verification on 24 November 2026: Actionlint passed for both workflows; ShellCheck passed for deployment scripts; synthetic environment validation accepted a matching configuration and rejected a mismatched CORS origin; Compose resolved external env files and removed all three application build contexts; all three local image targets built with matching revision labels. An isolated local Compose project using those versioned image tags completed five Prisma migrations, returned 200 for frontend `/login`, and passed API readiness. Its containers were stopped without deleting the test database volume. Existing tests passed: 27 backend unit, 11 HTTP, 13 PostgreSQL integration, and five frontend demo checks; backend/frontend typechecks and Prisma schema validation passed. These results do not establish GHCR or EC2 behavior.
