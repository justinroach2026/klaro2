# Klaro

Voice-first, multilingual SOP documentation. An AI interviewer (voice or chat) turns what you say into a structured Standard Operating Procedure.

**Stack:** React 19, TypeScript, Vite, Tailwind 4, Zustand, Supabase (auth + Postgres + RLS), Gemini (AI), Vercel (hosting + serverless functions).

## Architecture

- `src/` — the SPA. Interview flow in `src/modules/interview`, SOP viewer/editor in `src/modules/sop`, templates in `src/lib/templates.ts`.
- `api/ai/[action].ts` — the Vercel function behind `/api/ai/{chat,search,fetch-url,transcribe,speak}`. All Gemini calls happen here so the key never reaches the browser. Every request must carry a valid Supabase session token.
- `api/_lib/` — shared handlers (Gemini wrapper, auth check, SSRF-safe URL fetcher).
- `server/ai-proxy.ts` — dev-only Vite middleware that serves `/api/ai/*` with the same handlers, so `npm run dev` needs no extra tooling.
- `supabase/migrations/` — the database schema: a full baseline plus later changes (see Database below).

## Environment variables

Copy `.env.example` to `.env`. Server-only variables must **not** have a `VITE_` prefix.

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | client + server | Supabase project; the server also uses them to verify user tokens |
| `GEMINI_API_KEY` | server only | Google AI Studio key |
| `GEMINI_MODEL`, `GEMINI_TTS_MODEL` | server only, optional | Override the defaults in `api/_lib/gemini.ts` |

## Development

```bash
npm install
npm run dev
```

## Database (Supabase)

`supabase/migrations/20261020000000_baseline.sql` creates the entire schema (tables, policies, functions, triggers, storage buckets and explicit grants), so a new project or Supabase preview branch can be built from the repo. Later migrations sit next to it; `supabase/migrations_archive/` holds the pre-baseline history for reference.

New tables need explicit `GRANT`s in the migration that creates them (Supabase stopped auto-granting Data API access to new `public` tables on 2026-10-30). The app has no signed-out features, so `anon` has no access to the `public` schema. Rules for writing migrations are in `CLAUDE.md`.

To regenerate the baseline from the live project: `python execution/export_schema_baseline.py` (needs `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID` in `.env`).

## Deploy (Vercel)

Import the repo, set the variables above in the project settings, and deploy. `vercel.json` rewrites all non-`/api` routes to `index.html` so deep links work.
