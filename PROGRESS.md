# PROGRESS.md: Project state and session log

This file is the only source for the current project state. Each agent session must read this file at the start. Each agent session must update this file at the end.

## 1. Current stage

| Item | Value |
|---|---|
| Stage | S2: Offline core (started early, D-46). The S1 gate is still open. |
| Stage dates | S1: 2026-10-28 to 2026-11-03. S2: 2026-11-04 to 2026-11-10 (work started 2026-10-26). |
| Gate status | S1 open (operation items only). S2 open. |
| Gate criteria | `docs/05-testing/test-plan.md`, section 8 |

## 2. Stage tracker

| Stage | Name | Dates | Status |
|---|---|---|---|
| S0 | Plan and design | 2026-10-21 to 2026-10-27 | Gate passed 2026-10-25 (`docs/05-testing/reports/S0-test-report.md`) |
| S1 | Foundation | 2026-10-28 to 2026-11-03 | Code tests pass. Gate open: keep-alive B and C, a scheduled run of A, backend coverage measure. `prod` comes before S5 (D-40). |
| S2 | Offline core (DTR and sync) | 2026-11-04 to 2026-11-10 | In work (D-46) |
| S3 | Reports, corrections, and admin web | 2026-11-11 to 2026-11-14 | Not started |
| S4 | Completion and quality tests | 2026-11-15 to 2026-11-18 | Not started |
| S5 | Release and documentation | 2026-11-19 to 2026-11-21 | Not started |

## 3. Next tasks (stages S1 and S2)

The prerequisite status is in `docs/01-project/readiness-and-stage-plan.md`, section 1.

S2 order (bottom-up, system modules section 2): `sync_push` and `sync_pull` (TC-CI-SYNC-*, TC-U-SRV-01), then the client adapters (network, location, device ID, request timeout O-5), then the sync engine in layer 2 (TC-U-SYNC-*), then the repositories, then the DTR service in layer 4 (TC-U-DTR-*), then the DTR pages.

Open S1 items:

1. Keep-alive. Source A (`keepalive.yml`) exists. Source B is deferred (D-45): set it up (runbook, section 3.4) if source A has no scheduled run by 2026-10-28, and in all cases before the S1 gate. Source C: calendar reminders (Monday and Thursday). Make sure that the first scheduled `keepalive.yml` run passes. On 2026-10-26 at 05:05 UTC, no scheduled run had started (the cron time is 01:17 UTC). GitHub can delay or skip scheduled runs. If no run starts by 2026-10-28, source B becomes urgent.
2. Agent: the S1 test report draft exists (`docs/05-testing/reports/S1-test-report.md`). Close its open items (section 5), then do the gate check. Decide a backend coverage measure (QR-MA-05) before the S2 gate.
3. User (later): run TC-SI-PLUG-01 again on a real Android phone (readiness plan, item 8).
4. The UI/UX team makes the UI/UX design (D-26). When it is ready, put it in `docs/04-uiux/`.

## 4. Completed work

| Date | Item |
|---|---|
| 2026-10-21 | Module plan and module interactions |
| 2026-10-21 | Network infrastructure plan |
| 2026-10-21 | Functional requirements and ISO/IEC 25010 quality requirements |
| 2026-10-21 | Bottom-up test plan, test case register, and stage gates |
| 2026-10-21 | Folder structure and agent memory files |
| 2026-10-21 | Document "OJT-DTR - System Documents - Rev 1" (overview, modules, network infrastructure, requirements summary, test plan, test cases) in `deliverables/` |
| 2026-10-21 | Backend decision: Supabase Free plan (D-14). iOS optional (D-15). Free plan runbook with three protection layers (D-17 to D-21). |
| 2026-10-21 | Upload to Google Drive: "OJT-DTR - System Documents - Rev 1.docx" (211,045 bytes, DOCX format, not converted to Google Docs) |
| 2026-10-21 | Google Drive: Google Docs copy "OJT-DTR - System Documents - Rev 1" with three tabs: System Documents, TL;DR (plain summary), UI/UX Mood Board. Sources: `docs/01-project/tldr-summary.md`, `docs/01-project/uiux-moodboard-summary.md`. |
| 2026-10-21 | Review of the UI/UX Figma file: 7 screens and the mood board done. Missing screens recorded in `docs/01-project/uiux-moodboard-summary.md`, section 5. |
| 2026-10-21 | Presentation plan for 5 minutes: `docs/01-project/presentation-plan.md` |
| 2026-10-21 | Google Doc tab "Requirements (full list)": all FRs and QRs from `docs/02-requirements/`. Google Doc is the primary file (D-27). |
| 2026-10-21 | Canva deck "OJTTrack Project Review" (9 slides, from `presentation-plan.md`), design ID DAHYoD6gvH0, in the Canva team "Team Yey". Slides 7 and 8 have Canva sample mockups; replace them with the real Figma screens. |
| 2026-10-21 | Single file with only the three S0 plans: `deliverables/OJT-DTR - Module, Network, and Test Plans - Rev 1.docx` and `.pdf` (8 pages). Uploaded to Google Drive (both files). |
| 2026-10-21 | Simple Canva deck (text only, 9 slides), design ID DAHYoLajMos, Team Yey. Replaces the first deck DAHYoD6gvH0, which the user can delete in Canva. |
| 2026-10-21 | Google Doc restructured into 13 tabs: Home, TL;DR, 1 to 6 (one part each), 7 Offline Sync Design, 8 Data Model, 9 Project Plan, 10 Decision Log, UI/UX Mood Board. Tab-to-source map in `docs/AGENTS.md`, section 4. |
| 2026-10-25 | Prerequisites: Supabase CLI 2.122.0, GitHub CLI 2.103.2, `JAVA_HOME` = JDK 21, Android 15 emulator image and AVD `ojt_dtr_api35`, local git repository (D-36). |
| 2026-10-25 | S0 gate passed. TC-ST-REV-01 and TC-ST-REV-02 pass. Six review defects (DEF-001 to DEF-006) found and closed. TC-ST-REV-03 waived (D-33). The user accepted the test plan. |
| 2026-10-25 | S1 (part): Ionic Angular standalone app in `system/frontend/` (Angular 22.2.3, Ionic 9.0.9, Capacitor 8.5.3), Android platform. Debug APK builds with JDK 21 and opens on the emulator (R-06 closed). Layer 0 hours utilities: TC-U-UTIL-01 to TC-U-UTIL-05 pass (14 of 14 tests pass, `hours.ts` 100% line coverage). Lint: zero errors. |
| 2026-10-25 | Supabase `ojt-dtr-dev` made in the same account (D-40). Migrations: core schema, RLS on all 13 `public` tables, audit triggers, append-only punches, heartbeat (O-3 closed). Seed: 9 accounts, 2 companies, 1 batch, 6 assignments. |
| 2026-10-25 | GitHub: private repository `RN22345/ojt-dtr`. `dev` secrets set. `ci.yml` and `keepalive.yml` (source A) added. |
| 2026-10-25 | Backend L2 tests: TC-CI-ACL-03 passes (14 tests; the Edge Function part waits for S3). TC-CI-AUTH-01: 2 of 3 pass, 1 fails (DEF-007). Smoke test passes. |
| 2026-10-25 | Auth settings pushed to `dev` (JWT 900 s, sign-up off, minimum password 8). DEF-007 closed: test design fault, test corrected (D-41). Backend L2: 19 of 19 pass. |
| 2026-10-25 | Frontend: Supabase client, secure token storage (D-42), login with the platform check (D-38), route guards, wireframe role shells. TC-U-AUTH-03 and TC-CI-AUTH-02 (fake client) pass: frontend 74 of 74 tests pass, 85% line coverage, lint zero errors. |
| 2026-10-25 | TC-SI-AUTH-01 passes: OJT and facilitator log in on the Android emulator, admin logs in on the web app. Each sees only the tabs of the role. An admin login on Android is refused and stores no session. A typed URL of another role goes back to the home of the role. |
| 2026-10-26 | Local database: `LocalDb` adapter (SQLite plugin on mobile, sql.js in tests), local schema v1 (10 tables), migrations, outbox, profile cache, punch repository. TC-CI-DB-01 and TC-CI-DB-02 pass. On the emulator: `user_version` 1, 10 tables, cached profile row. |
| 2026-10-26 | Auth tests: TC-U-AUTH-01, TC-U-AUTH-02, TC-U-AUTH-04 pass (TC-U-AUTH-04 in a separate suite, D-43). TC-CI-AUTH-03 passes for logout and password change (client and server). The admin reset part waits for the `admin-users` Edge Function (S3). |
| 2026-10-26 | ESLint: no import between feature folders (QR-MA-01) and complexity 10 or less (QR-MA-04). A probe file showed that both rules report errors. |
| 2026-10-26 | TC-SI-PLUG-01 passes on the emulator: 13 of 13 calls for the 9 plugins of the functional requirements, section 13, plus secure storage. Geolocation needs a GPS fix on the emulator. Local reminders use inexact alarms (D-44). Push registration waits for FCM (readiness plan, item 10). Debug APK: 19.5 MB (QR-PE-06 target for the release APK: 25 MB). |
| 2026-10-26 | Own backup: `backup.yml` (each Sunday 02:17 Manila time; AES-256 GPG archive as a pre-release of the private repository; newest 8 stay). First run passed: release `backup-ojt-dtr-dev-20261026-0657`. A decrypt test with the user's passphrase passed: roles, schema, and data of `public`, `ops`, and `auth` (with `auth.users`). The full restore test is TC-ST-Q-RE-04 (before S4). |
| 2026-10-26 | Test totals: frontend 90 of 90 pass, 83% line coverage, lint zero errors. Backend L2 24 of 24 pass. |

## 5. Open issues

| ID | Issue | Owner | Status |
|---|---|---|---|
| Q-03, Q-04, Q-08 | Answers are defaults and can change later. Design for change (D-30). | User | Watch |
| Q-06, Q-07 | The real team size and due date are not final. Plan as solo, due 2026-11-21 (D-29, D-32). | User | Watch |
| UI-01 | The UI/UX design does not agree with the requirements in four items. See `docs/01-project/uiux-moodboard-summary.md`, section 6. The requirements are the source (D-34). Tell the UI/UX team. | User and UI/UX team | Closed by D-34 |
| ENV-01 | `ojt-dtr-dev` exists (D-40). `ojt-dtr-prod` comes before S5. Then pause KitaFix (ask its team) or `dev`. | User | Watch |
| ENV-02 | The GitHub repository exists. The weekly backup waited for the `dev` database password (readiness plan, item 4b). `backup.yml` exists and the first backup passed on 2026-10-26. | User | Closed |
| ENV-04 | The `dev` Auth settings were the Supabase defaults. Pushed on 2026-10-25. | Agent | Closed |
| O-5 | supabase-js has no request timeout. On the emulator just after a cold boot, the first login waited about 25 s, and one attempt ended with "Server not reachable". Add a timeout to the fetch wrapper in S2 (with the fault injector, D-20; offline sync design, section 13). | Agent | Open |
| DM-01 | The data model has no punch type for a correction request of kind `add`. The server cannot make the new punch without it. Decide in S3 before COR work (add `requested_type`, then update the data model). | Agent | Open |
| KA-01 | QR-RE-06 (Must) needs two automatic keep-alive sources. Only source A exists, and it has no scheduled run yet (the workflow is active; the GitHub scheduler skipped the 2026-10-26 run). Source B is deferred (D-45). The S1 gate cannot pass without source B. | User and agent | Open |
| ENV-03 | The `docs/deliverables/` files were lost in the D-28 move. They were restored from `OJT-Appdev-Project.zip`. The path in `extract_test_cases.py` was fixed again. The Google Doc tabs do not show the S0 review fixes yet. | Agent | Watch |

## 6. Session log

Add one row at the end of each session. Use the newest row at the bottom.

| Date | Agent or harness | Summary | Files changed |
|---|---|---|---|
| 2026-10-21 | Claude (claude.ai) | Created the folder structure, the agent memory files, the plan, the quality requirements, and the test plan. | All files |
| 2026-10-21 | Claude (claude.ai) | Changed the backend to Supabase Free plan. Added the operations runbook (keep-alive, tolerance, recovery, backups). Updated the requirements, architecture, test plan, and test cases. | `docs/01-project/*`, `docs/02-requirements/*`, `docs/03-architecture/*`, `docs/05-testing/*`, `docs/07-operations/*`, `backend/AGENTS.md`, `frontend/AGENTS.md`, root files |
| 2026-10-21 | Claude (claude.ai) | Reduced the agent memory files to root, `docs/`, `frontend/`, `backend/` (D-25). Recorded the Google Drive folder (D-24). Made the Rev 1 document (DOCX). | `AGENTS.md`, `README.md`, `docs/AGENTS.md`, decision log, `deliverables/` |
| 2026-10-21 | Claude Code (desktop) | Deleted the 8 old subfolder `AGENTS.md` files and the empty folders `docs/04-uiux/` and `docs/06-user-docs/` (D-25). Uploaded the Rev 1 DOCX to the Google Drive folder. | `docs/*/AGENTS.md` (deleted), `PROGRESS.md` |
| 2026-10-21 | Claude Code (desktop) | Reviewed the UI/UX Figma file. Made the Google Docs copy of Rev 1 with TL;DR and UI/UX Mood Board tabs. Wrote the 5-minute presentation plan. Added open issue UI-01. | `docs/01-project/tldr-summary.md`, `docs/01-project/uiux-moodboard-summary.md`, `docs/01-project/presentation-plan.md`, `deliverables/source/uiux-moodboard.jpg`, `docs/AGENTS.md`, `PROGRESS.md` |
| 2026-10-21 | Claude Code (desktop) | Added the Google Doc tab "Requirements (full list)". Recorded D-27 (Google Doc is the primary file). Added `md2html.py` for tab content. | `docs/01-project/decision-log.md`, `AGENTS.md`, `deliverables/source/md2html.py`, `PROGRESS.md` |
| 2026-10-21 | Claude Code (desktop) | Split the Google Doc main tab into one tab for each part. Merged the requirements summary and full list into tab 4. Added a Home tab and tabs 7 to 10 with rendered Mermaid diagrams. Added Mermaid rendering to `md2html.py`. | `deliverables/source/md2html.py`, `docs/01-project/tldr-summary.md`, `docs/AGENTS.md`, `PROGRESS.md` |
| 2026-10-21 | Claude Code (desktop) | Made the Canva deck. Added `VARIANT=core3` to `build.js` and built the single file with the module, network, and test plans (DOCX and PDF). Rendered `modmap.png` and `network.png`. | `deliverables/source/build.js`, `deliverables/source/network.mmd`, `deliverables/source/*.png`, `deliverables/OJT-DTR - Module, Network, and Test Plans - Rev 1.*`, `AGENTS.md`, `PROGRESS.md` |
| 2026-10-25 | Claude Code (desktop) | Unzipped the project. Split the folders (D-28): moved `frontend/` and `backend/` to `system/`, and `deliverables/` to `docs/deliverables/`. Updated path references. Older log rows keep the old paths. | `AGENTS.md`, `README.md`, `docs/AGENTS.md`, decision log, runbook, test plan, network doc, `docs/deliverables/source/extract_test_cases.py`, `PROGRESS.md` |
| 2026-10-25 | Claude Code (desktop) | Recorded answers to Q-03, Q-04, Q-06, Q-07, Q-08 (defaults or accepted assumptions). Added D-29 to D-32 and risk R-10. Moved the due date to 2026-11-21 and shortened S3 to S5. Added frontend rules for placeholders and design for change. | `docs/01-project/project-charter.md`, `timeline.md`, `decision-log.md`, `docs/05-testing/test-plan.md`, `AGENTS.md`, `system/frontend/AGENTS.md`, `PROGRESS.md` |
| 2026-10-25 | Claude Code (desktop) | Checked the build prerequisites and wrote the readiness and stage plan. | `docs/01-project/readiness-and-stage-plan.md`, `docs/AGENTS.md`, `PROGRESS.md` |
| 2026-10-25 | Claude Code (desktop) | Installed the prerequisites (D-36). Ran the S0 reviews, fixed six document defects, passed the S0 gate. Started S1 without the backend (D-39): made the frontend app, the Android build, and the layer 0 hours utilities with tests. Restored `docs/deliverables/`. Made the local git repository. | `.gitignore`, `AGENTS.md`, `PROGRESS.md`, `docs/AGENTS.md`, decision log (D-33 to D-39), readiness plan, FR-DTR-09, QR-SE-03, system modules 6.1, data model, network doc, test plan, test cases, defect log, `docs/05-testing/reports/S0-test-report.md`, `docs/deliverables/*`, `system/frontend/*` |
| 2026-10-25 | Claude Code (desktop) | Made `ojt-dtr-dev` in the same Supabase account (D-40). Applied the core schema and RLS, seeded the test accounts, added the heartbeat and the smoke test. Made the private GitHub repository, the CI and keep-alive workflows, and the GitHub secrets. Wrote the L2 tests: TC-CI-ACL-03 passes, TC-CI-AUTH-01 finds DEF-007. | `system/backend/*`, `.github/workflows/*`, decision log (D-40), runbook section 2, readiness plan, defect log, root `AGENTS.md`, `PROGRESS.md` |
| 2026-10-25 | Claude Code (desktop) | Pushed the Auth settings to `dev`. Found that the first push turned off email login (`[auth.email] enable_signup`) and fixed it at once. Closed DEF-007 as a test design fault (D-41). Built login, guards, and role shells. Selected the secure storage plugin (D-42). Ran TC-SI-AUTH-01 on the emulator and the web. | `system/backend/supabase/config.toml`, `auth-settings.md`, `tests/auth.test.ts`, `system/frontend/src/*`, `system/frontend/AGENTS.md`, `system/backend/AGENTS.md`, decision log (D-41, D-42), defect log, test cases, readiness plan, `.claude/launch.json`, root `AGENTS.md`, `PROGRESS.md` |
| 2026-10-26 | Claude Code (desktop) | Built the local database, the outbox, and the repositories. Added the Auth account tests and the separate rate-limit suite (D-43). Added the ESLint module and complexity rules. Installed the Capacitor plugins and ran TC-SI-PLUG-01 on the emulator. Found that exact reminders open a system screen (D-44). Added `user_id` to the outbox design. | `system/frontend/*`, `system/backend/tests/auth-account.test.ts`, `system/backend/tests-ratelimit/*`, `system/backend/package.json`, decision log (D-43, D-44), offline sync design 2.1, both `system/*/AGENTS.md`, `PROGRESS.md` |
| 2026-10-26 | Claude Code (desktop) | Wrote the source B settings (runbook 3.4). The user deferred source B (D-45); it is still necessary for the S1 gate (QR-RE-06). Examined source A: the workflow is active, the scheduler skipped the first run. Wrote the S1 test report draft. | runbook, decision log (D-45), `docs/05-testing/reports/S1-test-report.md`, `docs/AGENTS.md`, `PROGRESS.md` |
| 2026-10-26 | Claude Code (desktop) | The user set `DB_URL_DEV` and `BACKUP_PASSPHRASE`. Added `backup.yml`, ran the first backup, and did a decrypt test. | `.github/workflows/backup.yml`, runbook 6.2 and 6.3, `system/backend/AGENTS.md`, S1 report, `PROGRESS.md` |
