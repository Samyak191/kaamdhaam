# Security and authorization review

Reviewed 23 November 2026. Enforcement lives in NestJS guards and service queries; frontend role checks only control navigation. Private resource lookups return 404 where appropriate. Admin grants are separate database records and there is no self-service admin route.

| Actor | Jobs and proposals | Contracts and milestones | Messages and notifications | Organization and profile |
| --- | --- | --- | --- | --- |
| Anonymous | Published jobs and profiles only | None | None | None |
| Authenticated, incomplete onboarding | Public reads; onboarding only | None | None | Own identity only |
| Freelancer | Propose to another organization's OPEN job; own proposals | Assigned contracts; submit own milestones | Assigned conversation; own notifications | Own profile and skills |
| Client OWNER | Draft, edit, publish, manage proposals, hire for owned organization | Read; approve, request revision, complete or cancel under state rules | Owned contract conversations; own notifications | Own organizations |
| Client non-OWNER member | Read member organization jobs and proposals | Read member organization contracts | Conversation access requires OWNER and CLIENT role | Read member organization |
| Dual role | Union of permitted roles; self-proposal/self-hire checks still apply | Rights follow actual contract party and membership | Rights follow contract and recipient | Both self-service areas |
| Suspended | Public reads only | Protected routes denied | Protected routes denied | Protected routes denied |
| Explicit ADMIN grant | No implicit bypass of marketplace ownership | No implicit bypass | No implicit bypass | Administrative route not exposed in this MVP |

JWT verification requires the configured issuer, audience, signed RS256/ES256 key from the trusted JWKS, expiration, issued-at, authenticated role, and UUID subject. A genuine hosted ES256 token was verified in Sprint 1. Tests cover missing, malformed, forged, wrong issuer/audience, expired, unsupported-algorithm tokens and suspended accounts. No HS256 fallback exists. The Nest guard resolves the application user from the verified subject; browser-supplied roles or user IDs are not trusted.

The request pipeline now adds Helmet headers, `Cache-Control: no-store`, a 32 KiB JSON body cap, explicit CORS methods/headers, a generated request ID, and per-route in-memory limits (GET/HEAD and mutations separately). `TRUST_PROXY_HOPS=0` is the safe local default. Set it to `1` only when the backend is reachable exclusively through the trusted reverse proxy. A directly reachable backend with proxy trust enabled would let clients spoof IP headers. The single-process limiter is **not** a global control across multiple replicas; use a shared limiter or edge control before scaling out.

Error contract: `HttpException`s (validation 400, 401, 403, 404, 409, 413, 429) keep their Nest bodies so users still see actionable validation messages. Any other thrown value becomes a generic HTTP 500 `{ statusCode, error, message, requestId }`; the cause, name and stack are logged server-side as an `unhandled_error` line keyed by the same request ID, and never reach the client. `X-Powered-By` is removed and `X-Request-Id` is exposed to browsers through CORS. Covered by the error-handling HTTP test suite.

Rate limiting keys on the client IP as seen by Express under `TRUST_PROXY_HOPS`. It does not use the Supabase subject because the throttler runs as a global guard before the per-controller `AuthGuard` verifies the token, and keying on an unverified bearer header would let an attacker mint fresh buckets. Consequence: users behind one carrier-grade NAT share the per-IP read budget (600/min by default). If that becomes a real problem, move `AuthGuard` to a global guard and key the write limit on the verified user ID; keep an IP-based limit for anonymous routes.

User content is stored as text and rendered by React as text. No `dangerouslySetInnerHTML`, direct PostgreSQL access, service-role key, or token logging was found in application source. DTOs use whitelist and reject extra fields. Monetary values are bigint paise in PostgreSQL. Unique constraints and serializable/conditional transactions protect hiring and contract transitions. Current tests cover the main authorization and concurrency paths; a full penetration test and independent security review have not occurred.

Known residual risks: hosted Supabase signup/reset path callbacks have not been separately reverified since the Site URL change; an in-memory limiter resets on restart; contract list responses include submission history and may grow; no production TLS/domain or WAF exists yet; operational secret rotation is procedural. Never treat a passing local test suite as a public launch approval.
