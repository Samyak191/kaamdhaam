# Controlled beta release checklist

Status on 23 November 2026: **preparation only; do not deploy yet**. Check items only after direct evidence.

- [x] Local marketplace implemented with two real test accounts in Sprint 2.
- [x] Backend validation, unit, HTTP and PostgreSQL tests ran locally before Sprint 3.
- [x] Dedicated Supabase recovery email landed at `localhost:5173` after URL correction.
- [x] Final Sprint 3 backend, frontend, live and demo regressions recorded in [verification](verification.md).
- [ ] Fresh signup confirmation and password reset callback tested with user-assisted email links.
- [x] Account switching and token refresh tested after frontend state changes (browser auth and hosted lifecycle checks).
- [x] Production images built and isolated Compose stack started with health/readiness, SPA fallback and SIGTERM restart checks.
- [x] Limited logical backup restored into a separate isolated database (22 tables, 5 migrations).
- [ ] Encrypted off-host backup and populated-data recovery rehearsed.
- [ ] Independent security review and privacy/compliance review completed.
- [ ] AWS account, budget, IAM MFA, least privilege and monitoring configured by authorized owner.
- [ ] Domain acquired; DNS and trusted HTTPS configured; no public HTTP login.
- [ ] Production Supabase Site URL/allowlist and exact backend CORS origin updated and verified.
- [ ] Secrets stored outside Git/images, rotated and recovery access documented.
- [ ] Production database migration, backup, release and rollback rehearsed.
- [ ] Public beta user support, abuse handling and data-retention policy decided.

The current application has no payment flow. A payments release would require a separate financial, legal and security workstream.
