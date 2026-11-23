# Sprint 3 verification record

Starting Git state: clean `main` at `61de0ef`. No push or deployment authorized. Docker validation uses the isolated `kaamdham-sprint3-check` project and never resets existing development volumes.

## Final Sprint 3 regression (23 November 2026, after all code changes)

| Gate | Result |
| --- | --- |
| Backend typecheck, Prisma validate, migration status | Passed; five migrations, schema up to date; production build passed. |
| Backend unit tests | **27 passed** (JWT, auth guard, env validation, identity service, health). The JWT suite's key-generation hook timed out once at Jest's 5 s default while a frontend build ran concurrently; the hook timeout is now 30 s and the suite passes. |
| Backend HTTP tests | **10 passed**: security headers, 413 body cap, CORS allowlist, 429 throttling, 404, error contract (generic 500 without internals, HttpException bodies preserved, malformed JSON, no X-Powered-By). |
| PostgreSQL integration tests | **13 passed** on the test container (identity 6, marketplace 7). |
| Frontend typecheck, demo service tests, production build | Passed. `index` 247.66 kB raw / 77.91 kB gzip; `LiveApp` 251.42 kB raw / 66.05 kB gzip; no 500 kB warning. |
| Live browser smoke (Chrome headless against Vite + restarted API) | **7 passed**: homepage, public jobs, public talent, protected redirect, signup form, mobile job and talent filters. |
| Browser authentication | **Passed**: login, session survives reload, logout, protected redirect after logout, freelancer cannot see client projects. |
| Hosted Supabase auth lifecycle (two designated test accounts) | **Passed** for both: wrong password rejected, login, session restore, token refresh, backend accepts refreshed token, logout clears session. |
| Two-user marketplace journey with a third authenticated identity | **7 stages passed** against local API and dev PostgreSQL: anonymous/forged tokens rejected with request ID and security headers; draft privacy; third-party publish denied; validation rejects fractional paise and non-whitelisted `status`/`createdAt`; self-proposal and duplicate proposal rejected; third-party shortlist/hire denied; two concurrent hire requests with one Idempotency-Key produced exactly one contract; third-party contract, message, milestone and notification access denied (403 or 404); oversized message rejected; revision history, approvals, completion, closed messaging and notifications verified. One unpublished draft job from an aborted first run remains in the dev database as controlled test data. |
| Compose config, build and isolated startup (`kaamdham-sprint3-check`, port 18080) | **Passed**: images built; one-shot migration exited 0; db, backend and web healthy; SPA deep link returned 200; `X-Request-Id` visible through Nginx; `SIGTERM` stopped backend with exit 0; restart returned ready; `down` without `-v` kept the volume. |
| Load smoke through isolated Nginx (40 requests x 3 routes, concurrency 4) | Zero errors. health 55.7 req/s p50 47.5 ms p95 149 ms; jobs 31.5 req/s p50 101 ms p95 389 ms; freelancers 43.2 req/s p50 83 ms p95 178 ms. Slower than the earlier run in [performance](performance.md) because Docker image builds had just finished on the same laptop; neither run is a capacity figure. |
| Dependency audit | Production dependencies: **0 vulnerabilities** in frontend and backend. Development-only: 3 moderate (`glob`/`minimatch` under `@nestjs/cli`); fix needs a Nest CLI major upgrade, deferred. |
| Backup/restore | Limited drill only (see [operations](operations.md)); not repeated after code changes because no schema changed. Encrypted off-host restore remains untested. |

## Not verified in Sprint 3

- Fresh signup confirmation email, password-recovery email callback and password update need a human to click hosted email links. Only URL construction (`window.location.origin` + `/login` or `/reset-password`) and the earlier recovery redirect were checked.
- No penetration test or independent security review.
- No AWS resource exists; nothing was deployed or pushed.

## Readiness classification

| Area | Verdict |
| --- | --- |
| Local MVP | Ready: full two-user flow, demo mode and browser checks pass. |
| Application security | Hardened and regression-tested; single-process rate limiter and pending email-flow checks are known gaps. Not independently reviewed. |
| Production containers | Validated locally in isolation; digests not yet pinned. |
| AWS infrastructure | Designed and documented only; no account configuration, domain, TLS or backups exist. |
| Public beta launch | Not ready: needs domain, HTTPS, Supabase production redirect config, off-host backups, monitoring and the email-link checks above. |
| Payments and compliance | Not started by design. |
