# KaamDhaam documentation index

| Document | Covers |
| --- | --- |
| [security.md](security.md) | Authorization matrix, JWT verification, request hardening, rate limiting, error contract, residual risks |
| [performance.md](performance.md) | Frontend bundle before/after, data-fetching and polling behaviour, database query review, load smoke results |
| [operations.md](operations.md) | Startup, health and readiness, structured logs, migrations, backup and restore, monitoring, incident response |
| [aws-deployment.md](aws-deployment.md) | AWS architecture comparison and recommendation, cost assumptions, containers, HTTPS and DNS, AWS security checklist, release procedure |
| [release-checklist.md](release-checklist.md) | Evidence-based gates before any public beta |
| [verification.md](verification.md) | Sprint 3 test record and readiness classification |

Deployment files live in [`deploy/`](../deploy/) (Compose, Nginx, env templates), the container builds are [`Dockerfile`](../Dockerfile) and [`backend/Dockerfile`](../backend/Dockerfile), and the test-only CI workflow is [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Nothing in this repository deploys or creates cloud resources.
