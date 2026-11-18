# KaamDhaam frontend prototype

KaamDhaam is an India-first freelance marketplace prototype built with React, TypeScript, Vite, Tailwind CSS, shadcn-style primitives, and Lucide icons. It extends the original landing page and job browser with marketplace discovery, client and freelancer workflows, and an operations dashboard.

## Run locally

```bash
npm install
npm run dev
```

Use `npm run build` for the production bundle, `npm run preview` to serve it, and `npm run test:demo` for the deterministic mock service workflow. `node scripts/browser-flow.mjs` and `node scripts/check-layout.mjs` run the browser checks when local Chrome is available.

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
