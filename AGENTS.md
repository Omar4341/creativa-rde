# Creativa RDE — Event Registration & Attendance API

## What this is
NestJS backend API (no frontend) for event registration and attendance management.
Uses Supabase (hosted PostgreSQL + Auth) as its database — the app has no local database.

## Base44 dev environment
- Run: `docker compose -f docker-compose.base44.yml up -d`
- The `api` service uses `node:24` with the source bind-mounted at `/app` and `pnpm start:dev` (nest watch mode) — edits hot-reload without rebuilds.
- Port 3000 is the only exposed port (the API itself).
- pnpm store is in a named volume to survive container restarts.

## Environment
- `env_file` order: `.env.base44-defaults` (placeholders, boots the app) then `/run/base44/app.env` (real secrets, wins).
- `ALLOWED_ORIGINS` is set in compose `environment:` to the preview origin (overrides both env files — intentional, it's a config value not a secret).
- Zod env validation (`src/config/env.validation.ts`) runs at startup and refuses to boot if any required var is missing/invalid.
- `QR_JWT_SECRET` must be ≥32 chars.

## Verifying it works
- `curl http://localhost:3000/health` → 200 `{success:true,data:{status:"ok",...}}` (no DB connectivity check).
- `curl -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"p"}'` → 401 if Supabase credentials are real; 500-ish errors if they're placeholders.
- Root `/` returns 404 JSON — expected, this is an API not a webpage.

## Supabase credentials
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY come from the Supabase dashboard → Project Settings → API.
- The **service_role key** is the one the backend actually uses for all DB writes/reads — without a real one, auth registration/login will fail.
- Supabase migrations live in `supabase/migrations/` and must be applied to the Supabase project (via Supabase dashboard SQL editor or `supabase db push`).

## Tests
- Unit: `pnpm test` (vitest)
- E2E: `pnpm test:e2e`
- DB phase2: `node scripts/test-phase2-database.mjs` (needs real Supabase creds)
