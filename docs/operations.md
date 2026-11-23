# Operations and recovery runbook

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
