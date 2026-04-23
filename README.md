# VisitFlow

VisitFlow is a visitor management platform for offices, studios, and regulated workspaces. It pairs a self-serve guest kiosk with an operator backend for check-in, compliance, and visitor communications. The app is a single Express + Vite TypeScript project with a React UI.

## Features

- **Guest check-in** — kiosk/self-service flow where visitors identify themselves, select a host, acknowledge required documents, and are recorded as checked in.
- **Admin backend** — operator dashboard for the front-desk team: live visitor roster, check-in/check-out actions, search, and CSV export.
- **Signed document PDFs** — every acknowledgment generates a downloadable PDF (rendered with `pdf-lib`) that captures signer, document, signature, and timestamp for the audit trail.
- **Configurable documents & OSHA waivers** — administrators can create and publish document templates (NDAs, OSHA waivers, site-specific safety notices) and toggle which are required at check-in.
- **SOC 2 readiness center** — built-in view of compliance controls and an immutable audit log of visitor and admin activity, intended as a starting point for SOC 2 evidence collection.
- **SMS simulation** — simulated SMS campaign tool for host notifications and visitor reminders; useful for demos and for exercising the notification UX without wiring a real SMS provider.

## Tech stack

- React 18 + Vite 7, Tailwind CSS, Radix UI / shadcn components, TanStack Query, Wouter.
- Express 5 + TypeScript (tsx in dev, esbuild bundle in prod).
- SQLite via `better-sqlite3` with Drizzle ORM + Zod schemas (shared between client and server).
- `pdf-lib` for signed document generation.

## Project layout

```
client/    React app (pages, components, hooks, lib)
server/    Express server, routes, storage, Vite middleware
shared/    Drizzle/Zod schemas shared across client and server
script/    Build script (esbuild + Vite client build)
```

## Local setup

Prerequisites: Node.js 20+ and npm.

```bash
npm install
npm run db:push     # create / sync the SQLite schema (data.db)
npm run dev         # start the dev server on the default port
```

The dev server serves the React client through Vite middleware, so one process runs both the API and the UI. `data.db` (and its WAL/SHM siblings) is created on first run and is intentionally gitignored.

### Development commands

| Command | Description |
| --- | --- |
| `npm run dev` | Run the TypeScript Express server with Vite middleware (hot reload). |
| `npm run build` | Build the client and bundle the server into `dist/` via `script/build.ts`. |
| `npm start` | Run the production bundle (`NODE_ENV=production node dist/index.cjs`). |
| `npm run check` | TypeScript type-check (`tsc`). |
| `npm run db:push` | Push the Drizzle schema to the SQLite database. |

## Production / deployment notes

- `npm run build` produces a single `dist/index.cjs` server bundle plus the static client assets.
- Run with `npm start`. The server expects a writable working directory for `data.db`; mount a volume if you're deploying to a container.
- No external SMS or email provider is required — outbound messaging is simulated. When you're ready to send real SMS, replace the simulation in the SMS campaigns route with a provider (Twilio, etc.) and inject credentials via `.env`.
- Sessions are in-memory (`memorystore`); for multi-instance deployments, swap in a shared session store.
- Do **not** commit `data.db`, `data.db-wal`, `data.db-shm`, `node_modules/`, `dist/`, `.env*`, or `*.log` — all are covered by `.gitignore`.

## Roadmap / next steps

- Replace the SMS simulation with a real provider (Twilio / MessageBird) behind a feature flag.
- Add authenticated admin accounts (Passport is wired in but the full login flow is a next step).
- Move from SQLite to Postgres for multi-instance deployments; the Drizzle schema is already portable.
- Expand the SOC 2 readiness center with evidence upload and control-owner assignment.
- Add host-facing email/calendar invites and pre-registration links.
- Harden document templates with versioning so signed PDFs always reference the exact text acknowledged.
