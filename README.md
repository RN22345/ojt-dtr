# OJT Weekly Report and DTR Monitoring System (OJT-DTR)

A mobile app and a web app for on-the-job training (OJT). OJT trainees record their daily time record (DTR) and write weekly reports. Facilitators monitor and approve the records of their OJTs. Admins manage users, host companies, and batches.

The key feature is **offline mode**: an OJT can time in, time out, and write reports with no network. The app saves each change on the device and sends it to the server when the network returns. No data is lost and no record is saved two times.

Course: SOFTDEV, PLV (BSIT). Due date: 2026-11-21.

## Links

| What | Link |
|---|---|
| UI starter file (Figma): screens copied from the code, mockups for unbuilt screens, components, and a clickable prototype | [OJT-DTR App - UI Starter](https://www.figma.com/design/0STcZXRJO5eLpSn2d9ff2p) |
| UI/UX mood board (Figma): colors, fonts, and first screen designs by the UI/UX team | [OJT Weekly Report and DTR Monitoring](https://www.figma.com/design/bMKurAvFxJW1rP2lVEMBx4/OJT-Weekly-Report-and-DTR-Monitoring) |
| Shared documents (Google Drive): the document set as a Google Doc, with DOCX, PDF, and PPTX copies | [Project folder](https://drive.google.com/drive/u/0/folders/1HO_Jxxigs5hl_rsPjGUE1L9R7nDC7aFD) |
| Current project state | [`PROGRESS.md`](PROGRESS.md) |

The Markdown files in this repository are the source of the documents. The Drive files are made from them.

## Current status

| Stage | Name | Status |
|---|---|---|
| S0 | Plan and design | Done. Gate passed on 2026-10-25. |
| S1 | Foundation (login, database, CI, keep-alive) | Code and tests done. The gate waits for two keep-alive items (external cron service and calendar reminders). |
| S2 | Offline core (DTR and sync) | Done and tested on an Android emulator. The gate waits for the S1 gate. |
| S3 | Weekly reports, corrections, admin web app | Not started |
| S4 | Completion and quality tests on a real phone | Not started |
| S5 | Release and documentation | Not started |

What works today:

- **Login** for the three roles, with the platform rule: OJT and facilitator use the mobile app, admin uses the web app.
- **OJT**: time in and time out in one tap, offline. Optional location and selfie (the company sets this). DTR history with the sync status of each punch. A warning before a logout that would lose unsynced changes.
- **Sync**: save first, send later. Retries, a "Sync issues" screen, and an automatic recovery if the server is rebuilt.
- **Facilitator**: the list of assigned OJTs, with each OJT's hours and DTR. Punches with a doubtful device clock are flagged.
- **Backend**: the database with access rules for each role, an audit log, photo storage, and the sync functions.

Not built yet (wireframes only): OJT Home, Reports, Progress, Profile, Notifications, facilitator Reviews, and the admin web pages. These come in S3 and S4.

Automated tests: 184 frontend tests and 92 backend tests. GitHub Actions runs lint, unit tests, and backend tests on each push.

## Technology

| Part | Choice |
|---|---|
| App | Ionic 9 and Angular 22 (standalone components), Capacitor 8 for Android |
| Device storage | SQLite (`@capacitor-community/sqlite`) |
| Capacitor plugins | Network, Geolocation, Camera, Filesystem, App lifecycle |
| Backend | Supabase Free plan: PostgreSQL with row-level security, Auth, Storage, database functions |
| Tests | Vitest and Angular tests (frontend), Vitest against a dev Supabase project (backend) |
| Quality model | ISO/IEC 25010:2023, with a bottom-up test plan |

All cloud services use free tiers only.

## Repository map

| Folder | What is in it |
|---|---|
| `system/frontend/` | The Ionic Angular app, with the Android platform |
| `system/backend/` | Database migrations, seed data, API contract, backend tests, operation scripts |
| `docs/00-standards/` | The writing rules (ASD-STE100) |
| `docs/01-project/` | Charter, timeline, decision log, stage plan, UI/UX mood board summary |
| `docs/02-requirements/` | Functional requirements and quality requirements |
| `docs/03-architecture/` | Modules, data model, offline sync design, network infrastructure |
| `docs/04-uiux/` | Reserved for the final UI/UX design from the UI/UX team |
| `docs/05-testing/` | Test plan, test cases, defect log, stage test reports |
| `docs/06-user-docs/` | User guides |
| `docs/07-operations/` | Runbook for the free backend: keep-alive, backup, recovery |
| `docs/deliverables/` | DOCX and PDF outputs and their build sources |
| `.github/workflows/` | CI (`ci.yml`) and the keep-alive job (`keepalive.yml`) |

## Where to start reading

| You want to | Open |
|---|---|
| Know the scope and the open questions | [`docs/01-project/project-charter.md`](docs/01-project/project-charter.md) |
| Know the schedule | [`docs/01-project/timeline.md`](docs/01-project/timeline.md) |
| Know why a choice was made | [`docs/01-project/decision-log.md`](docs/01-project/decision-log.md) |
| Know what the system must do | [`docs/02-requirements/functional-requirements.md`](docs/02-requirements/functional-requirements.md) |
| Know the quality targets | [`docs/02-requirements/quality-requirements-iso25010.md`](docs/02-requirements/quality-requirements-iso25010.md) |
| Know the modules and how they interact | [`docs/03-architecture/system-modules.md`](docs/03-architecture/system-modules.md) |
| Know how offline mode operates | [`docs/03-architecture/offline-sync-design.md`](docs/03-architecture/offline-sync-design.md) |
| Know the data model | [`docs/03-architecture/data-model.md`](docs/03-architecture/data-model.md) |
| Know the network infrastructure | [`docs/03-architecture/network-infrastructure.md`](docs/03-architecture/network-infrastructure.md) |
| Know how to test each stage | [`docs/05-testing/test-plan.md`](docs/05-testing/test-plan.md) |
| See the test results of a stage | [`docs/05-testing/reports/`](docs/05-testing/reports/) |
| Run the system | [`docs/06-user-docs/how-to-run-guide.md`](docs/06-user-docs/how-to-run-guide.md) |
| Keep the free backend active, or recover it | [`docs/07-operations/free-tier-operations-runbook.md`](docs/07-operations/free-tier-operations-runbook.md) |

## Run and test

You need Node.js. For the Android build, you also need the Android SDK and Java 21.

```bash
# Frontend: install, run in a browser, test, lint
cd system/frontend
npm ci
npm start
npx ng test --watch=false
npx ng lint
```

```bash
# Backend tests (they run against the dev Supabase project)
cd system/backend
npm ci
cp .env.example .env   # then fill in the values
npm test
```

Secrets (passwords, keys, tokens) are never in the repository. They live in local `.env` files, which Git ignores, and in GitHub secrets.

## Working in this repository

- Write documents in ASD-STE100 (Simplified Technical English).
- Record each decision in the decision log. Do not change or reuse a published ID.
- Obey the stage gates in the test plan.
- Contributors who use AI coding agents: read [`AGENTS.md`](AGENTS.md) first.
