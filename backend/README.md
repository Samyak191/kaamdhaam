# KaamDhaam API — authentication and marketplace

NestJS 11 REST API under `/v1`. Local PostgreSQL 17 owns application identities, organizations, jobs, proposals, contracts and audit records. Supabase Auth owns passwords and sessions. The React demo frontend is separate and unchanged.

## Local setup (PowerShell)

Use Node.js 22.12+ and Docker Desktop. From `backend`:

```powershell
npm ci
Copy-Item .env.example .env
# Edit ignored .env with distinct local development and test PostgreSQL credentials.
docker compose up -d postgres
docker compose --profile test up -d postgres-test
npm run db:validate
npm run db:generate
npm run db:deploy
npm run db:status
npm run start:dev
```

`DATABASE_URL` targets only the KaamDhaam development database. `TEST_DATABASE_URL` targets a separate local `kaamdham_test` database. To migrate the test database in another PowerShell window, load the test URL into `$env:DATABASE_URL`, run `npm run db:deploy`, then remove that environment override. Never reset a populated database or remove Compose volumes. Compose pins PostgreSQL 17.12 and binds ports to localhost; this machine uses 15543 and 15544 because other local services reserve 5432 and nearby ports.

Set `SUPABASE_ISSUER` to the dedicated project's exact `/auth/v1` URL, `SUPABASE_JWKS_URL` to its `/auth/v1/.well-known/jwks.json`, and `SUPABASE_AUDIENCE=authenticated`. `SUPABASE_PUBLISHABLE_KEY` is public and used only for local Auth signup/login checks; the API itself verifies JWTs using JWKS. Put project-specific values only in ignored `.env`, never source. The application database is PostgreSQL, never the Supabase database. The API accepts only RS256/ES256 signed access tokens, with matching issuer, audience, issued-at, expiry, UUID subject and `authenticated` role. It rejects unsigned and HS256 tokens. New verified subjects get a role-free application user; suspended users receive 403. No client-supplied user ID or role overrides the verified principal.

The dedicated hosted development project was verified with an ES256 JWKS key and a genuine confirmed test account. Signup, password login, `/v1/me`, onboarding, second role, freelancer profile, OWNER organization membership and audit records were exercised. Keep passwords, access tokens and refresh tokens in ignored local storage and out of logs/chat. Email confirmation remains enabled. To repeat manually, use Supabase's official Auth signup/login API or SDK, confirm the email, and send the issued access token as `Authorization: Bearer <token>` to the local API. See [Supabase Auth signup](https://supabase.com/docs/reference/javascript/auth-signup) and [JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys).

## Routes

Public reads return only OPEN jobs and complete, active freelancer profiles. Lists use validated `limit` (1–50) and `offset` (0–10000), with `total`; results are bounded. Job `sort` accepts `newest`, `budget_asc`, or `budget_desc`. Skills are exact normalized names. Money is stored as PostgreSQL BIGINT paise and returned as decimal strings.

| Method | Route | Access and purpose |
| --- | --- | --- |
| GET | `/v1/health`, `/v1/ready` | Public liveness and database readiness |
| GET | `/v1/jobs`, `/v1/jobs/:id` | Public OPEN job discovery and detail; search, skill and budget filters |
| GET | `/v1/freelancers`, `/v1/freelancers/:id` | Public profile discovery; search, skill, city and state filters |
| GET | `/v1/me` | Authenticated application identity |
| POST | `/v1/me/onboarding` | One-time role, profile and optional organization setup |
| POST | `/v1/me/roles` | Add CLIENT or FREELANCER role |
| PATCH | `/v1/me/profile`, `/v1/me/skills` | Update own profile or normalized freelancer skills |
| GET | `/v1/me/organizations`, `/v1/organizations/:id` | Member-only organization reads |
| POST | `/v1/organizations` | CLIENT creates organization and becomes OWNER |
| POST | `/v1/jobs` | Organization OWNER creates DRAFT job |
| PATCH | `/v1/jobs/:id` | OWNER edits DRAFT only |
| POST | `/v1/jobs/:id/publish` | OWNER atomically moves DRAFT to OPEN |
| GET | `/v1/me/jobs` | CLIENT lists member-organization jobs |
| POST | `/v1/jobs/:id/proposals` | FREELANCER submits one proposal to an OPEN job |
| GET | `/v1/me/proposals` | FREELANCER lists own private proposals |
| GET | `/v1/jobs/:id/proposals` | Organization member lists its private job proposals |
| POST | `/v1/proposals/:id/shortlist`, `/v1/proposals/:id/reject` | OWNER transitions eligible proposals on OPEN jobs |
| POST | `/v1/proposals/:id/hire` | OWNER hires with required `Idempotency-Key` |

Job edits stop at publication so submitted proposals cannot be invalidated. Proposals from an organization's own members are forbidden. Duplicate proposals are blocked by a database unique constraint. Optional milestone plans must sum exactly to the bid. No payment, funding, escrow or withdrawal state is present.

Hiring uses a PostgreSQL SERIALIZABLE Prisma transaction with bounded retries. The transaction checks an eligible proposal and OPEN job, changes job and proposal to HIRED, creates a unique contract and copied milestones, writes an audit event, and persists the actor-scoped idempotency outcome. The unique `contracts.job_id` constraint is an additional final guard. A retry with the same actor, key and proposal returns the same contract; key reuse for a different proposal returns 409. Hire keys are retained permanently in this MVP, including after contract completion. Authorization is rechecked for replays. Concurrent competing hires yield one 201 and one 409. A successful hire does not automatically reject other proposals; their job is no longer OPEN, so they cannot be hired.

Organization members can read their organization's proposals. Only OWNER members with CLIENT role can mutate jobs, transition proposals or hire. Nonmembers receive 404 for private resources. No public endpoint grants ADMIN. Auth verification and suspension checks precede protected endpoints. Audit events contain IDs and limited event metadata, not JWTs, passwords or full proposal bodies.

## OpenAPI, tests and limits

Swagger UI is at `/v1/docs` and JSON at `/v1/openapi.json` only outside production. A generated snapshot is saved in `openapi.json`. Request and response DTOs, auth requirements, pagination and hire idempotency header are documented.

```powershell
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run test:integration
npm run db:validate
npm run db:generate
npm run db:status
```

Integration tests require the migrated isolated `kaamdham_test` PostgreSQL database and use controlled signed JWTs. They cover public visibility, role and organization authorization, duplicate proposals, status transitions, concurrent hiring, idempotent replay, one-contract uniqueness, milestones and audit counts. Existing identity tests cover JWT rejection and suspended users. The hosted Supabase smoke test requires a confirmed email and network access and is intentionally separate from the deterministic suite.

Current MVP limits: no contract completion/cancellation API, messaging, payment processing, organization invites, proposal withdrawal or frontend API wiring. Search uses bounded offset pagination and case-insensitive substring matching; use cursor pagination and appropriate text indexes before very large datasets. Skills are normalized on write and limited to ten per profile/job, but the catalog has no moderation workflow. Audit retention and operational access need a production policy. The old isolated local Supabase CLI stack in ignored `tmp` remains stopped because its database port did not bind to localhost; the hosted dedicated development project is used for Auth verification instead.
