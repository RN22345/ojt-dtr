# API contract

This document is the API contract of the OJT-DTR backend (D-23, QR-CO-02). It lists each table, RLS policy, RPC function, and Edge Function. Update it in the same commit as each change to the schema.

Status: S1, migrations `20261025134548_core_schema` and `20261025134615_restrict_anon_functions`.

## 1. Interfaces

| Interface | Path | Format |
|---|---|---|
| Data API (PostgREST) | `/rest/v1/<table>` | REST with JSON. Supabase JWT in `Authorization`. Project key in `apikey`. |
| RPC | `/rest/v1/rpc/<function>` | POST with a JSON body |
| Auth | `/auth/v1/*` | Supabase Auth |
| Edge Functions | `/functions/v1/<name>` | Not deployed yet (S3, S4) |

The Data API exposes only the `public` schema. The `private` and `ops` schemas are not exposed.

## 2. Grants

| Role | Grants |
|---|---|
| `anon` | No table access. EXECUTE on `heartbeat` only. |
| `authenticated` | SELECT on all `public` tables (RLS filters the rows). INSERT and UPDATE on `companies`, `batches`, `ojt_assignments`, `devices`. UPDATE on `profiles`. No DELETE. |

The mobile app writes only through `sync_push` (S2). Thus mobile roles have no other write path.

## 3. Tables and RLS policies

"Peer" means a person in an active assignment with the user (the facilitator of an OJT, or an OJT of a facilitator).

| Table | Policy | Action | Who |
|---|---|---|---|
| `profiles` | `profiles_select_own` | SELECT | Own row |
| | `profiles_select_peer` | SELECT | Peers (active OJT or facilitator only) |
| | `profiles_select_admin` | SELECT | Admin |
| | `profiles_update_admin` | UPDATE | Admin |
| `companies` | `companies_select_assigned` | SELECT | OJT and facilitator: companies of own active assignments |
| | `companies_select_admin`, `companies_insert_admin`, `companies_update_admin` | SELECT, INSERT, UPDATE | Admin |
| `batches` | `batches_select_assigned` | SELECT | OJT and facilitator: batches of own active assignments |
| | `batches_select_admin`, `batches_insert_admin`, `batches_update_admin` | SELECT, INSERT, UPDATE | Admin |
| `ojt_assignments` | `assignments_select_ojt` | SELECT | OJT: own assignments |
| | `assignments_select_facilitator` | SELECT | Facilitator: assignments where it is the facilitator |
| | `assignments_select_admin`, `assignments_insert_admin`, `assignments_update_admin` | SELECT, INSERT, UPDATE | Admin |
| `punches` | `punches_select` | SELECT | The OJT, its active facilitator, admin |
| `weekly_reports` | `weekly_reports_select` | SELECT | The OJT, its active facilitator, admin |
| `correction_requests` | `correction_requests_select` | SELECT | The OJT, its active facilitator, admin |
| `attachments` | `attachments_select` | SELECT | The owner OJT, its active facilitator, admin |
| `report_events` | `report_events_select` | SELECT | Users who can read the report |
| `devices` | `devices_select_own`, `devices_insert_own`, `devices_update_own` | SELECT, INSERT, UPDATE | Own rows. INSERT: active OJT or facilitator only. |
| `notifications` | `notifications_select_own` | SELECT | Own rows |
| `audit_logs` | `audit_logs_select_admin` | SELECT | Admin |
| `processed_ops` | None | None | Only `sync_push` (S2) |

An inactive account (`profiles.status = 'inactive'`) gets no role. Thus it reads only its own profile row.

## 4. Server rules (triggers)

| Trigger | Table | Rule |
|---|---|---|
| `touch` | All synced tables | Sets `version`, `created_at`, `updated_at`, `change_seq` (the pull cursor, D-11) |
| `check_roles` | `ojt_assignments` | `ojt_id` must be an OJT. `facilitator_id` must be a facilitator. One active assignment for each OJT (unique index). |
| `append_only` | `punches` | No DELETE. An UPDATE can change only `approved`, `doubtful_time`, and the common columns (D-05). |
| `read_only` | `audit_logs` | No UPDATE or DELETE (QR-SE-07) |
| `audit` | `profiles`, `ojt_assignments`, `companies`, `batches` (all changes); `weekly_reports` (status change); `correction_requests` (decision); `punches` (insert of a correction punch) | Writes one `audit_logs` row: actor, action, entity, before and after data (FR-AUD-01) |
| `on_auth_user_created` | `auth.users` | Makes the `profiles` row. The role comes from `app_metadata.role`. No role gives status `inactive`. |

## 5. RPC functions

| Function | Arguments | Returns | Who | Purpose |
|---|---|---|---|---|
| `heartbeat` | `source text`, `secret text` | `timestamptz` | `anon`, `authenticated` (needs the keep-alive secret) | Keep-alive write (runbook, section 3.1). `source`: 1 to 32 letters, digits, `_`, `-`. Wrong secret: error `28000`. |
| `heartbeat_status` | None | Table of `source`, `last_at` | `authenticated` (rows only for admin) | Newest heartbeat of each source |
| `server_epoch` | None | `uuid` | `authenticated` | Current server epoch (D-19) |
| `sync_push` | Planned (S2) | | | Offline sync design, section 4 |
| `sync_pull` | Planned (S2) | | | Offline sync design, section 5 |

## 6. Edge Functions

Planned: `admin-users` (S3), `export-csv` (S4), `push-notify` (S4). See `system/backend/AGENTS.md`.

## 7. Known advisor notes

| Note | Reason |
|---|---|
| `heartbeat`, `heartbeat_status`, `server_epoch` are SECURITY DEFINER functions that signed-in users can call | On purpose. `heartbeat` checks the secret. `heartbeat_status` returns rows only for an admin. `server_epoch` returns one UUID. |
| `heartbeat` can be called with the anon key | On purpose. The keep-alive sources have no user account. |
| Multiple permissive policies on `profiles`, `companies`, `batches`, `ojt_assignments` | Backend rule 3: one policy for one role and one action. The cost is small at this data size. |
| `processed_ops` has RLS and no policy | On purpose. Only `sync_push` uses it. |
