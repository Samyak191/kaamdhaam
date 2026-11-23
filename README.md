# KaamDhaam marketplace

KaamDhaam is an India-first freelance marketplace built with React, TypeScript, Vite, NestJS, PostgreSQL 17, and Supabase Auth. The original browser-only demo remains available. Live mode uses the same visual system and real API data.

## Run locally

```bash
npm install
npm run dev
```

Use `npm run build` for the production bundle, `npm run preview` to serve it, and `npm run test:demo` for the deterministic mock service workflow. `node scripts/browser-flow.mjs` and `node scripts/check-layout.mjs` run the browser checks when local Chrome is available.

## Live mode (PowerShell)

Start the backend first, following [backend setup](backend/README.md). It uses dedicated development and test PostgreSQL containers and the dedicated KaamDhaam Supabase Auth project. Do not reset populated databases or use credentials from another project.

```powershell
Copy-Item .env.example .env.local
# Edit ignored .env.local: set VITE_APP_MODE=live, the local API URL,
# the dedicated Supabase project URL, and its PUBLIC publishable key.
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. The API defaults to `http://127.0.0.1:4000/v1` and must allow that frontend origin through `CORS_ALLOWED_ORIGINS` in ignored `backend/.env`. Supabase owns signup, password login, confirmation, reset, session restoration, and token refresh. The frontend sends access tokens to the API as bearer tokens. The backend verifies each token against the project's JWKS. Never put a service-role key, signing key, database credential, or user token in Vite variables.

Set `VITE_APP_MODE=demo` and restart Vite to use the unchanged original browser demo without the backend. Live and demo state are separate; live mode never falls back to demo data. `.env.local` is ignored by Git and `.env.example` contains placeholders. In the dedicated Supabase project, set **Authentication → URL Configuration** to the frontend origin and allow the signup (`/login`) and password reset (`/reset-password`) redirects. On 23 November 2026, a fresh Supabase recovery email redirected to `http://localhost:5173/` after the project URL change; the signup and reset paths have not been separately retested with fresh email links.

Live mode supports public jobs and freelancer profiles; signup, login, onboarding and dual roles; client job drafts and publishing; proposals, shortlisting, rejection and idempotent hiring; contract milestones, submissions, revision requests, approvals and completion; persistent contract messages with explicit read markers; and in-app notifications. The frontend polls messages and notifications only while the page is visible. Jobs are fixed price, with INR stored as integer paise. Contract completion records work completion, not payment. No collection, escrow, releases, withdrawals, invoices, admin access, reviews, saved jobs, or pre-hire messaging are offered in live mode.

```powershell
npx tsc --noEmit
npm run build
npm run test:live-smoke  # local Chrome/Edge, API and frontend running in live mode
npm run test:demo
```

The live smoke test checks the original-style homepage, public listings, protected route redirect, auth form, and mobile filters. The two-user hosted journey additionally requires two confirmed test accounts; never put their passwords or tokens in source or chat.

## Routes

| Area | Routes |
| --- | --- |
| Public marketplace | `/`, `/jobs`, `/jobs/:id`, `/talent`, `/talent/:id`, `/enterprise`, `/support` |
| Demo account UI | `/login`, `/signup`, `/choose-role`, `/forgot-password`, `/verify-otp` |
| Shared workspace | `/messages`, `/messages/:id`, `/notifications`, `/contracts/:id`, `/invoices/:id` |
| Freelancer | `/dashboard/freelancer`, `/saved`, `/proposals`, `/contracts`, `/milestones`, `/earnings`, `/reviews`, `/settings` under that prefix |
| Client | `/dashboard/client`, `/projects`, `/projects/new`, `/projects/:id/edit`, `/proposals`, `/contracts`, `/milestones`, `/payments`, `/reviews`, `/settings` under that prefix |
| Admin | `/dashboard/admin` and its `/users`, `/projects`, `/contracts`, `/transactions`, `/kyc`, `/disputes`, `/reviews`, `/reports`, `/settings` sections |

## Demo workflow

Choose a role on the login or signup screen. A client can publish a project, review proposals, hire a freelancer, fund and approve a milestone, release a simulated payment, and leave a review. A freelancer can find jobs, send a proposal, work through milestones, view earnings, and request a simulated withdrawal. Both roles can exchange local messages, review notifications, and save preferences. The admin screens use the same linked sample data.

`src/data/demoModels.ts` defines the entities; `demoSeed.ts` provides stable linked sample records; `demoService.ts` handles guarded state transitions and versioned browser storage; `DemoStore.tsx` shares that state with the UI. The original Phase 1 saved jobs and proposals are migrated where possible. The reusable layout, badges, charts, cards, dialogs, and avatars live in `src/components`.

This is a browser-only demo. Role switching is a UI simulation; no credentials, documents, real payment details, or financial transactions are collected or processed. Attachments are file-name examples. Data persists only in the current browser's localStorage and can be reset in Settings. The original reference screenshots were unavailable in this workspace, so the design follows the existing Phase 1 styling rather than claiming an exact screenshot match.
