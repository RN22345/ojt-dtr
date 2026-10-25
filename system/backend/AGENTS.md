# AGENTS.md: system/backend/

This folder will contain the Supabase backend: migrations, RLS policies, database functions, Edge Functions, seed data, backend tests, and operation scripts.

## Status

Not created. Create the backend in stage S1 (D-14).

## Stack

| Part | Choice |
|---|---|
| Platform | Supabase, Free plan (two projects: `ojt-dtr-dev`, `ojt-dtr-prod`) |
| Database | PostgreSQL with Row Level Security (RLS) |
| Server logic | PostgreSQL functions (PL/pgSQL) for sync and rules. Edge Functions (TypeScript, Deno) for work that needs secrets. |
| Authentication | Supabase Auth (email and password). Roles in the `profiles` table. |
| Files | Supabase Storage (private buckets) |
| Tools | Supabase CLI (migrations, deploys, type generation) |
| Tests | Vitest with supabase-js against `dev` (L2). pgTAP with `supabase test db` if the local stack is available. |
| API contract | `supabase/api-contract.md` (D-23) |

## Planned structure

```
system/backend/
  supabase/
    config.toml
    migrations/        one SQL file for each schema change, in time order
    functions/
      admin-users/     create, deactivate, reset password (needs the service role key)
      push-notify/     send FCM messages (called from a database trigger)
      export-csv/      CSV export for the admin
    seed.sql           test accounts and volume data (dev and local only)
    tests/             pgTAP tests (optional)
    api-contract.md    tables, RLS policies, RPC functions, Edge Functions
    auth-settings.md   Auth dashboard settings (for the rebuild procedure)
  tests/               Vitest + supabase-js tests: RLS access matrix, sync_push, sync_pull
  ops/
    smoke-test         heartbeat, test login, one sync_pull
    backup             manual encrypted backup
    restore-storage    upload storage files from a backup
  .env.example
../.github/workflows/
  ci.yml               lint and tests on each push
  keepalive.yml        heartbeat each day (runbook, section 3)
  backup.yml           encrypted backup each week (runbook, section 6)
```

## Rules

1. Make each schema change as a migration file. Do not change the schema in the dashboard only. The rebuild procedure needs all changes in git.
2. Turn on RLS for each table in `public`. A table without RLS is an S1 defect.
3. Write each RLS policy for one role and one action. Add a test for each policy in the access matrix (TC-CI-ACL-*).
4. The mobile app writes only through `sync_push` (offline sync design, section 4). Give mobile roles no direct `insert`, `update`, or `delete` grants on synced tables.
5. Store all times in UTC (`timestamptz`). Clients show Asia/Manila time.
6. Do not update or delete a punch. A correction makes a new punch (D-05).
7. `sync_push` applies each `op_id` one time only (FR-SYNC-05).
8. Write an audit entry for each event in FR-AUD-01 with a trigger. The API must not change or delete audit entries.
9. Put secrets only in Edge Function secrets and GitHub secrets. Never commit the service role key.
10. Update `api-contract.md` in the same commit as each change to a table, policy, or function.
11. After a change to the Auth settings, update `auth-settings.md`.
12. Generate the TypeScript types after each migration: `supabase gen types typescript`. Put them in the frontend `data/` folder.
