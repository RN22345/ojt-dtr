# IT-EL-5 scope: preliminary draft

Status: DRAFT. Prepared by Claude Haiku 5.5 on 2026-10-26. This draft lists facts and options. It does not make decisions. A planning agent must review it and write the plan. No decision in this file is accepted until the user records it in `decision-log.md`.

## 1. What IT-EL-5 is

- IT-EL-5 is another subject. It uses this project as a base.
- The other subject's lead asked to add three parts:
  1. An ETL pipeline (extract, transform, load).
  2. A data warehouse (fact and dimension tables).
  3. A data analytics dashboard.
- The lead does not care how the front end or back end is built. He will grade only the three added parts.
- His grading is separate from the app development (SOFTDEV) grading.
- The user says the due date (2026-11-21, in `project-charter.md`) is not binding for this work.

## 2. What the user has confirmed

| Item | Answer |
|---|---|
| Which parts IT-EL-5 needs | ETL, data warehouse, data analytics. Nothing else. |
| Front end for the new parts | Any. Chosen by the team. |
| Back end for the new parts | Any. Chosen by the team. |
| Grading | Separate from SOFTDEV. Only the IT-EL-5 lead grades the new parts. |
| Due date | Not binding ("for gimmicks"). Keep the date as a planning target only. |
| Scope trade-offs | Open. "Whatever works and makes logical sense." |

## 3. What the inclusion means for the project

### 3.1 Project rules that apply (from `AGENTS.md`)

- Rule 11: Do not do work that is not in a requirement. Write the requirement first.
- Rule 3: Record each architecture, tool, or scope decision in `decision-log.md`.
- Rule 9: If a document and the code do not agree, stop. Record the problem in `PROGRESS.md` under "Open issues". Ask the user.
- Rule 6: Update the folder map in the nearest `AGENTS.md` when a file is added.
- The module codes are fixed (`AUTH`, `PROF`, `DTR`, `COR`, `RPT`, `MON`, `NOTI`, `EXP`, `ADM`, `AUD`, `SYNC`). A new module for warehouse or analytics needs a new code and a decision.
- The text standard is ASD-STE100 for all documents.

### 3.2 What the new parts need

| Part | What it needs | Notes |
|---|---|---|
| ETL | A job that reads the operational data and loads the warehouse. Options: SQL function with `pg_cron`, or a scheduled Edge Function. | Must not write to the tables that `sync_push` writes. Must be repeatable (same input, same result). |
| Data warehouse | A star schema: at least one fact table and dimension tables. | Choose the schema location: a separate schema in the same database, or a separate Supabase project. A second project uses another free slot. |
| Analytics | Charts and filters that read the warehouse. | Existing requirement FR-MON-03 (admin dashboard) and FR-MON-04 (filters) overlap with this work. Decide whether to reuse them. |

### 3.3 Requirements that do not exist yet

No functional requirement covers ETL, the warehouse, or analytics for IT-EL-5. Rule 11 means the planner must write these requirements first. Suggested items for the planner to write (wording and IDs are for the planner):

- A requirement for a nightly load of the warehouse.
- A requirement for the fact and dimension tables (which measures, which keys).
- A requirement for the analytics views (which charts, which filters).
- A requirement for the load check (row counts or totals match the source).

### 3.4 Documents that change

| Document | Change |
|---|---|
| `docs/03-architecture/system-modules.md` | New module or modules. |
| `docs/03-architecture/data-model.md` | Warehouse tables. |
| `docs/03-architecture/network-infrastructure.md` | Where the ETL runs and where the warehouse lives. |
| `docs/02-requirements/functional-requirements.md` | New requirements. |
| `docs/05-testing/test-plan.md` and `test-cases.md` | New test cases and possibly a new stage. |
| `docs/07-operations/free-tier-operations-runbook.md` | Jobs that run on a schedule. Backup scope for the warehouse. |
| Finale proposal (10 sections) | Section 6 (architecture) and section 8 (advanced database: ETL, replication, query optimization). |

## 4. Constraints to plan around

1. Free tier only. All cloud services must stay on free tiers. Check database and compute limits before adding scheduled jobs.
2. Supabase Free pauses after inactivity. The keep-alive sources (A and B) must cover the new jobs. Procedure A in the runbook applies to paused projects.
3. The backup (`backup.yml`) does not include Storage files (open issue BK-01). It may also need the warehouse schema, or the warehouse must be rebuildable from the operational data.
4. A live replica is not available on Supabase Free. The diagram box "Replica / Backup" has a backup today, not a replica.
5. The offline mobile app must keep working. The new parts are online-only. This matches the admin web rule (D-13).
6. Shared database. IT-EL-5 and SOFTDEV use the same database. Changes to one subject can break the other subject's tests. Ownership of each schema must be written down.
7. Current stage gates. Rule 4 says a new stage cannot start before the gate of the current stage passes. The S1 gate is still open (keep-alive source B, TC-ST-Q-RE-05). Plan the IT-EL-5 work after or beside that gate, and record the choice.

## 5. Current schedule (for reference)

| Stage | Dates | Status on 2026-10-26 |
|---|---|---|
| S0 | 2026-10-21 to 2026-10-27 | Gate passed 2026-10-25 |
| S1 | 2026-10-28 to 2026-11-03 | Code tests pass. Gate open (keep-alive B and C, TC-ST-Q-RE-05). |
| S2 | 2026-11-04 to 2026-11-10 | All S2 tests pass. Gate waits for S1. |
| S3 | 2026-11-11 to 2026-11-14 | Not started. Reports, corrections, admin web. |
| S4 | 2026-11-15 to 2026-11-18 | Not started. Quality tests. |
| S5 | 2026-11-19 to 2026-11-21 | Not started. Release. |

The planner must note that the existing S3 and S4 scope already fills most of their time. The user says the due date is soft. The planner must propose a new date or a new stage plan, and the user must accept it.

## 6. Options for the planner to evaluate

These are the options visible from the facts. They are not ranked.

### Option A: Minimal warehouse, same database

- One fact table (daily hours per OJT), dimensions for OJT, company, facilitator, batch, and date.
- Nightly SQL function with `pg_cron`.
- Charts reuse the admin web from S3.
- Warehouse in a separate schema (for example `dw`) in `ojt-dtr-dev`, and later in `ojt-dtr-prod`.
- Lowest cost and risk. Fits the free tier. Smallest change to the documents.

### Option B: Separate warehouse project

- A second Supabase project for the warehouse, for example `ojt-dtr-dw`.
- Isolates IT-EL-5 from SOFTDEV. Clear ownership.
- Uses a second free-project slot. Adds a second pause risk and a second keep-alive.
- ETL copies data across projects, so it needs a secure connection string. The secret goes in `.env` (rule 8).

### Option C: External analytics tool on the warehouse

- A free BI tool (for example Metabase or a similar tool) reads the warehouse.
- Less front end code. Adds a tool that must be hosted and kept free.
- The planner must check the tool's free-tier limits and its licence.

### Option D: Admin web charts only

- No external tool. The admin web app adds chart pages with the `dataviz` skill rules.
- Reuses the S3 admin web. Less new infrastructure.
- Depends on the S3 admin web being built first.

### Option E: Separate analysis with an export

- ETL writes CSV or Parquet files to Storage. The analysis is done in a notebook or a spreadsheet.
- Simplest. Weakest "data warehouse" and "dashboard" evidence. The IT-EL-5 lead may not accept it. Ask the lead first.

### Choices that are not options

- Do not change the operational tables to suit the warehouse. This reopens tested S2 parts.
- Do not write warehouse data from the mobile app. The app writes only through `sync_push`.

## 7. Questions for the user (before the plan is final)

1. Does the IT-EL-5 lead accept Option E (exports only), or does he require a real warehouse and dashboard?
2. Which data must the warehouse hold: punches only, or also reports, corrections, and audit records?
3. Which charts does the lead expect? Any fixed list?
4. Can the new work start before the S1 gate passes, or must it wait?
5. Who owns the shared database schemas (SOFTDEV or IT-EL-5)?
6. Should the new parts have their own module code (for example `DW` and `AN`), or should they be added to existing modules?

## 8. Sources

- `docs/01-project/project-charter.md` (due date and team, D-29)
- `docs/01-project/timeline.md`
- `docs/01-project/readiness-and-stage-plan.md`
- `docs/02-requirements/functional-requirements.md` (FR-MON-03, FR-MON-04, FR-RPT, FR-AUD)
- `docs/03-architecture/system-modules.md`
- `docs/03-architecture/network-infrastructure.md`
- `docs/07-operations/free-tier-operations-runbook.md`
- `PROGRESS.md` (open issues DM-01, BK-01, KA-01, ENV-01)
- User statements on 2026-10-26 (IT-EL-5 scope, grading, due date)
