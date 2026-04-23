# VisitFlow

VisitFlow is a visitor management platform for offices, studios, and regulated workspaces. It pairs a self-serve guest kiosk with an operator backend for check-in, compliance, and visitor communications. The app is a React + Vite frontend backed by an Express API that reads and writes through Supabase.

## Features

- **Guest check-in** — kiosk/self-service flow where visitors identify themselves, select a host, acknowledge required documents, and are recorded as checked in.
- **Admin backend** — operator dashboard for the front-desk team: live visitor roster, check-in/check-out actions, search, and CSV export.
- **Signed document PDFs** — every acknowledgment generates a downloadable PDF (rendered with `pdf-lib`) that captures signer, document, signature, and timestamp for the audit trail.
- **Configurable documents & OSHA waivers** — administrators can create and publish document templates (NDAs, OSHA waivers, site-specific safety notices) and toggle which are required at check-in.
- **SOC 2 readiness center** — built-in view of compliance controls and an immutable audit log of visitor and admin activity, intended as a starting point for SOC 2 evidence collection.
- **SMS simulation** — simulated SMS campaign tool for host notifications and visitor reminders; useful for demos and for exercising the notification UX without wiring a real SMS provider.

## Tech stack

- React 18 + Vite 7, Tailwind CSS, Radix UI / shadcn components, TanStack Query, Wouter.
- Express 5 + TypeScript (tsx in dev) for the API layer.
- Supabase (Postgres) via `@supabase/supabase-js`, accessed only from the server.
- `pdf-lib` for signed document generation.
- Vercel serverless functions for the deployed API (`api/index.ts` mounts the Express app).

## Project layout

```
client/    React app (pages, components, hooks, lib)
server/    Express app factory, routes, Supabase storage, Vite dev middleware
shared/    Zod schemas and shared types used by client and server
api/       Vercel serverless entry that boots the Express app
script/    Local production build (esbuild server bundle + Vite client build)
```

## Supabase setup

The server expects a Supabase project with the following tables in the `public` schema:

- `visitors`
- `compliance_controls`
- `sms_campaigns`
- `audit_logs`
- `document_templates`
- `signed_documents`

Columns follow the definitions in `shared/schema.ts` (the server maps snake_case columns to camelCase TypeScript types). Seed rows for the Standard Visitor NDA, Visitor Safety and OSHA Acknowledgment, and an init audit log should exist.

Environment variables (see `.env.example`):

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | yes | e.g. `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | yes (MVP) | Public anon key. Used by the server today while RLS is permissive. |
| `SUPABASE_SERVICE_ROLE_KEY` | no (recommended for prod) | If set, the server prefers this key over the anon key so it can bypass RLS. Must NEVER be exposed to the client. |

The server picks up whichever of `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` is defined (service role wins), so you can swap from anon to service role without code changes.

### Temporary MVP note on RLS

For this MVP, Supabase RLS policies are expected to be permissive so the anon key can read and write the visitor tables while the app is being shaken out. Before any real customer data is entered, the hardening steps below must be completed.

## Local development

Prerequisites: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env        # fill in SUPABASE_URL and SUPABASE_ANON_KEY
npm run dev                 # start the Express + Vite dev server on :5000
```

One process serves both the API (`/api/*`) and the React client via Vite middleware. Hash routing (`/#/admin`, etc.) works against the SPA.

### Development commands

| Command | Description |
| --- | --- |
| `npm run dev` | Run the Express server with Vite middleware (hot reload). |
| `npm run build` | Build the client and bundle the server into `dist/` (local prod). |
| `npm run build:client` | Build only the client (`dist/public`). Used by Vercel. |
| `npm start` | Run the locally-bundled production server. |
| `npm run check` | TypeScript type-check (`tsc`). |

## Vercel deployment

The repo ships with a `vercel.json` that tells Vercel to:

1. Run `npm run vercel-build` (alias for `vite build`) to produce the static client into `dist/public`.
2. Serve that directory as the static site.
3. Compile `api/index.ts` as a Node serverless function and rewrite any `/api/*` request to it. The function mounts the full Express app exported from `server/app.ts`, so every existing route keeps working with no code changes.

### Vercel project settings

- **Framework preset:** Other (let `vercel.json` drive it).
- **Build command:** leave blank — `vercel.json` sets `npm run vercel-build`.
- **Output directory:** leave blank — `vercel.json` sets `dist/public`.
- **Install command:** leave blank — `vercel.json` sets `npm install`.
- **Node.js version:** 20.x.

### Vercel environment variables

Add these to the Vercel project (Settings → Environment Variables), for the Production environment at minimum:

| Name | Example value | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | `https://atlnyfznamlgjksehvcp.supabase.co` | Same across envs. |
| `SUPABASE_ANON_KEY` | `eyJhbGciOi...` (Supabase → Settings → API → anon public) | MVP only. |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` (Supabase → Settings → API → service_role) | **Recommended.** When present the server uses this instead of the anon key. Mark as Sensitive. Do not expose to the browser. |

Hash routing for `/` and `/admin` works automatically because Vercel serves `dist/public/index.html` for any non-API path and the client handles `/#/...` internally.

## Hardening / next steps (production readiness)

1. **Service role on the server.** Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel so the API can bypass RLS safely. Remove the anon-key fallback from production.
2. **Restrictive RLS.** Turn on row-level security on all six tables and write explicit policies; deny all anon reads/writes by default and rely on the service role from the API.
3. **Admin authentication.** The admin dashboard and mutation endpoints currently trust the caller. Add Supabase Auth (or a compatible provider) and require an admin session for any `/api/visitors` mutation, SMS campaign, document template, audit-log read, and CSV export.
4. **Separate visitor / public endpoints.** Split the API surface so the guest check-in kiosk exposes only `POST /api/guest-check-in` and `GET /api/document-templates/active`, and the admin surface is gated behind auth. Consider different Supabase roles for each.
5. **Document template versioning.** Snapshot `body` on sign so audit PDFs always reflect the exact text the visitor acknowledged (the current `signed_documents.pdf_content` already stores a rendered copy — formalize the contract).
6. **Real SMS provider.** Swap the simulation for Twilio/MessageBird behind a feature flag; keep the opt-out/consent gating in `sms_campaigns`.
7. **Host email/calendar invites.** Pre-registration links, ICS attachments, and reminder emails.

## Security / secrets

- `.env` files are gitignored; only `.env.example` is committed.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in the client bundle. All database access is server-side and will stay that way.
- Supabase anon key is technically safe to expose, but in this repo it is only read on the server. Treat it as a server-only variable.
