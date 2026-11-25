# Operations and recovery runbook

The current Sydney EC2 release path is [GitHub Actions deployment](github-actions-deployment.md). The local procedures below remain useful for development and diagnosis.

## Local start and diagnosis

Use ignored `backend/.env` and `.env.local` files, then start the existing development PostgreSQL containers with the commands in [backend setup](../backend/README.md). Start API with `cd backend; npm run start:dev`; start frontend from repository root with `npm run dev`. Stop with Ctrl+C; Nest shutdown hooks disconnect Prisma on SIGINT/SIGTERM. Do not delete Docker volumes or reset populated databases.

Check `GET /v1/health` for process liveness and `GET /v1/ready` for PostgreSQL readiness. A 503 readiness response calls for checking PostgreSQL, `DATABASE_URL`, network, and migration status. JSON request logs (`event: http_request`) have timestamp, level (`info` under 400, `warn` for 4xx, `error` for 5xx), generated request ID, method, matched route template, status and duration. They intentionally omit headers, tokens, request bodies, message contents, identities and URL query strings. An unexpected exception additionally produces an `unhandled_error` line with the same request ID, the error name and message, and the stack trace on the server only. Use the `X-Request-Id` response header (exposed to browsers) to correlate a user report with those two lines. The access logger does not replace an APM trace.

```powershell
Invoke-WebRequest http://127.0.0.1:4000/v1/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:4000/v1/ready -UseBasicParsing
cd backend
npm run db:status
docker compose ps
docker compose logs --tail 100 postgres
```

For a future Compose host, use `docker compose --env-file deploy/.env -f deploy/compose.yaml ps` and `docker compose ... logs --tail 100 backend db`. The backend is intentionally not published on a host port. The web container is bound only to loopback; a separate host TLS proxy must serve the public domain. A failing backend healthcheck may mean database, migration, or JWKS-independent startup trouble. JWT failures require checking the configured issuer, JWKS URL, audience, Supabase signing key mode and server clock; never paste tokens into incident tickets.

## Migration and release

Review SQL and compatibility before release. Make an encrypted, verified backup before a risky migration. Build images, run `npm run db:deploy` as a one-shot step, wait for `/v1/ready`, then start/refresh web. Do not use `prisma migrate dev` or `prisma db push` in production. Schema changes should be additive first; deploy compatible application code, backfill if needed, and remove old columns in a later release. If Prisma reports a failed migration, stop rollout, inspect `_prisma_migrations` and the actual schema, and resolve deliberately using Prisma's migration recovery procedure. Do not assume SQL rollback is automatic. Roll back the application image only when it remains compatible with the migrated schema.

## Backup and restore

Sprint 4's [staging release plan](staging-release.md) and `deploy/scripts/backup.sh` / `restore-check.sh` provide encrypted streaming backup and isolated restore. Use those scripts for future staging; the older example below is a plaintext local drill only.

For the initial single-host beta, schedule a daily `pg_dump -Fc` from the database container to encrypted storage outside the EC2 instance, retain daily copies for 14 days and weekly copies for 8 weeks, and run a monthly restore drill. Size, retention and frequency are starting recommendations and must fit actual RPO/RTO and cost. Keep an EC2/EBS snapshot schedule as a second layer, not a substitute for a tested logical restore. Protect backup encryption keys separately; deny public bucket access and use least-privilege IAM. Monitor backup age and failures.

Example commands (substitute the actual Compose project and encrypted destination; avoid placing passwords in shell history):

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > kaamdham-$(date +%F).dump
createdb -h 127.0.0.1 -U restore_user kaamdham_restore_check
pg_restore --no-owner --exit-on-error -h 127.0.0.1 -U restore_user -d kaamdham_restore_check kaamdham-YYYY-MM-DD.dump
```

Restore **only** to a new isolated database, verify row counts, foreign keys and application readiness, then retire that temporary database under an approved cleanup procedure. Never restore over development, test or production in a drill. A limited local drill on 23 November 2026 created a custom-format dump of the isolated Compose database and restored it to `kaamdham_restore_check` in that same isolated container: 22 public tables and all 5 migration records were present. This did not test encrypted off-host storage, a populated production-scale dataset, or application startup against the restored database.

## Monitoring and incident response

Initial alert proposals: health unavailable for 2 minutes; readiness unavailable for 2 minutes; 5xx above 2% for 5 minutes with sufficient traffic; p95 over 2 seconds for 10 minutes; disk above 80%; backup older than 36 hours; repeated container restarts; TLS certificate under 14 days. Tune after observing real traffic. Monitor CPU, memory, EBS free space, PostgreSQL connections, HTTP latency and error rate, container restarts and AWS budget/credit usage. Keep access to logs restricted and set retention. On incident: stop risky rollout, preserve logs and request IDs, assess user impact, restore a compatible image or isolated database only after a reviewed recovery decision, then rotate any potentially exposed secrets and document the event. Rotate the Supabase publishable key only if needed; private keys and database credentials require coordinated updates to ignored deployment env and restart.

## Continuous delivery, backup retention and recovery (25 November 2026)

Every automatic or manual release of the live site runs `deploy/scripts/backup.sh` before `prisma migrate deploy` whenever the `kaamdham-beta_postgres_data` volume exists. The script streams `pg_dump -Fc` from the database container through `age` (public recipient only; the private identity is never on EC2 or in GitHub), writes `kaamdham-beta-<UTC stamp>.dump.age` plus a `.sha256`, uploads both to `s3://kaamdhaam-staging-backups-068152185887/backups/` with SSE-S3 using the EC2 instance role, and then reads the object back with `head-object` to confirm the stored size matches. A failed upload or size mismatch aborts the release before any migration runs. Releases write the local copy to `BACKUP_OUTPUT_DIR=/opt/kaamdhaam/backups`, an existing `github-runner`-owned `0700` directory outside the checkout; preflight fails closed if it is missing or not writable, and the scripts never create or re-own it. After a confirmed upload only the newest three local copies there are kept (`BACKUP_LOCAL_KEEP`); S3 is the system of record. The first object, `kaamdham-beta-20261125T065059Z.dump.age`, was produced by hand on 25 November 2026 and confirmed in S3.

**Retention.** Objects accumulate one per release plus any manual runs. Add an S3 lifecycle rule on the `backups/` prefix (console or `put-bucket-lifecycle-configuration`) that keeps daily objects 30 days and transitions older ones to Glacier Instant Retrieval or expires them after 90 days, according to cost and RPO decisions; this requires AWS console or CLI credentials and is not applied by the repository. Keep bucket public access blocked and versioning or Object Lock enabled if ransomware resilience is required. Alert if the newest object is older than 36 hours of activity or if a release reports `Encrypted backup verified in S3` missing.

**Restore drill (isolated, never over production).** From a workstation holding the age identity:

```bash
aws s3 cp s3://kaamdhaam-staging-backups-068152185887/backups/<file>.dump.age .
aws s3 cp s3://kaamdhaam-staging-backups-068152185887/backups/<file>.dump.age.sha256 .
sha256sum -c <file>.dump.age.sha256
# Start an isolated database with a throwaway Compose project name, then:
COMPOSE_PROJECT_NAME=kaamdham-restore AGE_IDENTITY_FILE=/secure/age-identity.txt \
RESTORE_DB=kaamdham_restore_check BACKUP_FILE=./<file>.dump.age bash deploy/scripts/restore-check.sh
```

`restore-check.sh` validates the archive with `pg_restore -l` before creating a database, refuses the production database name, requires a `_restore_check` suffix, and restores with `--exit-on-error`. Verify table and row counts, then drop the throwaway project (`docker compose -p kaamdham-restore down`, without `-v` unless that isolated volume is intended to go). Run this drill after the first automatic release and then monthly.

**Rollback.** Released image tags are never deleted, and `/opt/kaamdhaam/state/previous` holds the prior verified SHA. Application rollback is the server procedure in [github-actions-deployment.md](github-actions-deployment.md#rollback) and is only safe when the previous image is compatible with the current schema; migrations are never reversed automatically.
