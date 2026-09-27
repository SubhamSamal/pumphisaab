# Local database check (optional, developer only)

A fast way to try `supabase/migrations` and `supabase/tests` on this Mac without Docker.
It uses PGlite (an in-memory Postgres) plus a small stand-in for Supabase's `auth` schema and for pgTAP.

**The truth is always the GitHub CI run** (`.github/workflows/ci.yml`, job "Database"), which uses a real throwaway Supabase.

```bash
cd tools/db-local-check
npm install          # once
npm run migrate      # applies every migration, prints a few checks
npm test             # runs every supabase/tests/*.test.sql with the pgTAP stand-in
```

Not part of the app: it has its own package.json and isn't installed by the app's `npm install`.
