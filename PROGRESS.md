# PROGRESS.md: Project state and session log

This file is the only source for the current project state. Each agent session must read this file at the start. Each agent session must update this file at the end.

## 1. Current stage

| Item | Value |
|---|---|
| Stage | S1: Foundation (started early, D-39) |
| Stage dates | 2026-10-28 to 2026-11-03 (work started 2026-10-25) |
| Gate status | Open |
| Gate criteria | `docs/05-testing/test-plan.md`, section 8 |

## 2. Stage tracker

| Stage | Name | Dates | Status |
|---|---|---|---|
| S0 | Plan and design | 2026-10-21 to 2026-10-27 | Gate passed 2026-10-25 (`docs/05-testing/reports/S0-test-report.md`) |
| S1 | Foundation | 2026-10-28 to 2026-11-03 | In work. Backend tasks wait for the Supabase projects (D-35, D-39). |
| S2 | Offline core (DTR and sync) | 2026-11-04 to 2026-11-10 | Not started |
| S3 | Reports, corrections, and admin web | 2026-11-11 to 2026-11-14 | Not started |
| S4 | Completion and quality tests | 2026-11-15 to 2026-11-18 | Not started |
| S5 | Release and documentation | 2026-11-19 to 2026-11-21 | Not started |

## 3. Next tasks (stage S1)

The prerequisite status is in `docs/01-project/readiness-and-stage-plan.md`, section 1.

1. User: connect a second Supabase account (D-35). Then the agent makes `ojt-dtr-dev` and `ojt-dtr-prod` in the Singapore region.
2. User: run `gh auth login` one time. Then the agent makes a private GitHub repository, pushes `main`, and adds `ci.yml` (lint, L1, L2 on each push).
3. Agent, no backend needed: role shells with placeholder screens (D-31), route guards and TC-U-AUTH-03, SQLite adapter and local migrations (TC-CI-DB-01, TC-CI-DB-02), plugin test builds (TC-SI-PLUG-01, select the secure storage plugin, O-2).
4. Agent, after task 1: backend schema, RLS, seed, `ops` heartbeat (O-3), auth settings, TC-U-AUTH-01, 02, 04, TC-CI-AUTH-01 to 03, TC-CI-ACL-03, TC-SI-AUTH-01.
5. Agent and user, after tasks 1 and 2: keep-alive sources A, B, and C, and the first own backup (runbook, sections 3 and 6).
6. The UI/UX team makes the UI/UX design (D-26). When it is ready, put it in `docs/04-uiux/`.

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

## 5. Open issues

| ID | Issue | Owner | Status |
|---|---|---|---|
| Q-03, Q-04, Q-08 | Answers are defaults and can change later. Design for change (D-30). | User | Watch |
| Q-06, Q-07 | The real team size and due date are not final. Plan as solo, due 2026-11-21 (D-29, D-32). | User | Watch |
| UI-01 | The UI/UX design does not agree with the requirements in four items. See `docs/01-project/uiux-moodboard-summary.md`, section 6. The requirements are the source (D-34). Tell the UI/UX team. | User and UI/UX team | Closed by D-34 |
| ENV-01 | The Supabase projects `ojt-dtr-dev` and `ojt-dtr-prod` do not exist. They go in a second Supabase account (D-35). The S1 backend tasks wait. | User | Open |
| ENV-02 | No GitHub repository. `gh auth login` is necessary. CI, keep-alive source A, and the weekly backup wait. | User | Open |
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
