# KaamDhaam frontend prototype

Phase 1 of the KaamDhaam visual prototype. Built with React, TypeScript, Tailwind CSS, shadcn-style UI primitives, and Lucide icons. All data is local; saved jobs, demo role choices, and proposal submissions use browser localStorage. No backend, authentication service, or payment provider is connected.

## Run locally

```bash
npm install
npm run dev
```

Build with `npm run build`. The static output is in `dist/`.

## Included routes

- `/` — landing page
- `/jobs` — Browse Jobs with filters, sorting, search, and saved jobs
- `/jobs/:id` — job details and demo proposal form
- `/talent` — lightweight talent discovery preview
- `/enterprise`, `/login`, `/signup`, `/support` — navigable supporting previews

The supplied brief referenced two earlier screenshots, but only the pasted text attachment was available in this workspace. The visual system follows the detailed colors, spacing, and layout guidance in that brief.
