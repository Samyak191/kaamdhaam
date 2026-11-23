# AWS public beta preparation — no deployment performed

For the current Sprint 4 single-host staging proposal, HTTPS configuration, CloudFormation template, encrypted backup tooling, and approval gate, use [the staging release plan](staging-release.md). The cost comparison below is the earlier Sprint 3 planning baseline and uses US East assumptions.

## Architecture choice

Assumptions for comparison: US East (N. Virginia), Linux on demand, 730 hours/month, one small initial audience, 30 GiB gp3 disk, one public IPv4, 10 GiB backup/object storage, under 100 GB/month internet egress, single Availability Zone, no taxes, no support plan, no domain registration. These are planning ranges, **not quotes**; verify in the [AWS Pricing Calculator](https://calculator.aws/) for the chosen Region and account before ordering. Promotional credits and free tiers depend on eligibility and must not be assumed. AWS lists [public IPv4 at $0.005/hour](https://aws.amazon.com/vpc/pricing/) and [gp3 storage examples at $0.08/GB-month](https://aws.amazon.com/ebs/pricing/); compute, RDS, S3 requests, snapshots and data transfer vary by Region and use. See [EC2 pricing](https://aws.amazon.com/ec2/pricing/on-demand/), [RDS PostgreSQL pricing](https://aws.amazon.com/rds/postgresql/pricing/) and [S3 pricing](https://aws.amazon.com/s3/pricing/).

| Option | Illustrative monthly range before tax/credits | Operations and tradeoffs |
| --- | --- | --- |
| A: one EC2 with Compose for static web, API and PostgreSQL | **$35–70** under assumptions; verify compute rate | Lowest service count and easiest first deployment; single host is a single failure domain. Database backups and patching are our responsibility. 4 GiB RAM class is a safer starting point than 2 GiB; build images elsewhere. |
| B: EC2 for web/API plus managed RDS PostgreSQL | **$65–150+**; RDS class, storage, backup and networking drive range | Better DB isolation, managed backups and maintenance options, but higher fixed cost and more networking/security-group work. Still needs application recovery planning. |
| C: static frontend (S3/CloudFront) plus EC2 API/PostgreSQL | **$35–85** at low static traffic | Better static delivery and independent frontend deploys, but adds CDN/bucket configuration, cache invalidation and CORS complexity; database remains self-managed. |

Recommend **A** for a controlled, low-traffic beta after obtaining a domain and HTTPS. Start with a 4 GiB class only after checking actual regional cost and container memory. Use encrypted gp3 EBS, daily off-host encrypted backups, one public IPv4, and a budget alert. Expect planned maintenance for OS/security patches and no high availability. The Docker files in this repository prepare this topology; they do not create resources. S3 file uploads are **not implemented** in the app, so object storage is for backups first.

Scaling path: move PostgreSQL to RDS when reliability or operational load warrants it; add S3 for user uploads with private buckets and signed access; place API behind a load balancer; then use multiple API replicas, shared rate limiting, centralized logs and background jobs if actual traffic needs them. Do not add those services on speculation.

## Container configuration

`deploy/compose.yaml` uses a private network and persistent PostgreSQL volume. The one-shot migration service runs `prisma migrate deploy` after database health. Backend starts only after migration success; web starts after backend readiness. Backend and database have no published ports. Web binds to `127.0.0.1:8080`; the host TLS proxy is a required separate production step. `deploy/nginx.conf` serves the SPA and forwards `/v1/` to the backend, preserving paths. Frontend `VITE_*` values are embedded at build time and must contain **public values only**. Rebuild web for changed API or Supabase public configuration. Never commit populated `deploy/.env` or `deploy/backend.env`.

Local isolated validation (creates a separate Compose project/volume; never run against the existing development project): copy the example env files to ignored names, replace placeholders with test-only values, then run `docker compose --env-file deploy/.env -f deploy/compose.yaml -p kaamdham-sprint3-check config --quiet`, `build`, `up -d`, and check `http://127.0.0.1:8080/v1/ready`. Use `down` **without `-v`** to stop the test containers while preserving data. Image tags are pinned to versions; review upstream security updates and rebuild regularly. Pin immutable digests before an actual public release.

## HTTPS, DNS and security

Public Supabase authentication requires a real HTTPS origin. Obtain a domain, point DNS to the EC2 public address, and configure a trusted certificate with the host proxy (for example, Certbot plus Nginx) before exposing the site. An EC2 IPv4 address alone does not grant a conventional domain certificate. Until then, test only on loopback or a controlled HTTPS staging hostname. Update Supabase Site URL and redirect allowlist for the exact HTTPS origin and `/login` and `/reset-password` paths; `localhost` and `127.0.0.1` are distinct origins. Update `CORS_ORIGINS` to that exact origin. Do not enable public HTTP authentication.

AWS checklist before provisioning: root and human IAM MFA; least-privilege roles; no long-lived keys on the instance; security group 443 open, 22 restricted or use Systems Manager, 5432/4000/8080 closed publicly; encrypted EBS and off-host backup; OS updates; secrets in restricted env or a managed secret store, never images or Git; log retention and access controls; budget and credit alerts; DNS/TLS renewal monitoring. Nothing in this document authorizes cloud changes.

## Release procedure

Before release: verify CI, full local regression, dependency audit, SQL migration review, backup and restore drill, exact image tags/digests, production env, domain/TLS and Supabase callbacks. Build immutable images in CI or on a build host; take backup; run migration; start services; check health/readiness, frontend SPA routes, live signup/login/recovery callbacks and the two-user flow; watch logs, errors, latency and costs. Roll back the app image only if schema compatibility permits. Disable automatic deployment: the CI workflow tests only, and no deploy workflow is enabled.
