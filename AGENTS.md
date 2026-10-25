# AGENTS.md: OJT Weekly Report and DTR Monitoring System

This file is the main memory file for AI agents. Each agent tool must read this file first. This applies to Claude Code, the DeepSeek harness, Codex, Gemini CLI, Cursor, and all other tools.

## 1. Project summary

| Item | Value |
|---|---|
| Name | OJT Weekly Report and DTR Monitoring System |
| Short name | OJT-DTR |
| Course | SOFTDEV (PLV, BSIT) |
| Frontend | Ionic + Angular (standalone components) + Capacitor |
| Backend | Supabase, Free plan: PostgreSQL + RLS, Auth, Storage, database functions, Edge Functions (D-14) |
| User roles | OJT, facilitator, admin |
| Platforms | Mobile app (Android; iOS optional) for OJT and facilitator. Web app for admin. |
| Main constraint | The mobile app must operate offline. The system must use one or more Capacitor plugins. All cloud services use free tiers only. |
| Quality model | ISO/IEC 25010:2023 |
| Test approach | Bottom-up (see D-06) |
| Text standard | ASD-STE100 (Simplified Technical English) |
| Due date | 2026-11-21 (assumed, see Q-07 and D-29) |

## 2. Read order for a new session

1. Read this file.
2. Read `PROGRESS.md`. It gives the current stage, the open issues, and the next tasks.
3. Read `docs/00-standards/ste100-writing-rules.md`.
4. Read the `AGENTS.md` file in each folder where you will work.
5. Read the documents that the task refers to. Do not read all documents if the task does not need them.

## 3. Folder map

| Folder | Contents | Memory file |
|---|---|---|
| `/` | Project root, agent rules, progress log, `.gitignore`, `.gitattributes`. The git repository root (branch `main`, remote: private GitHub repository `RN22345/ojt-dtr`). | `AGENTS.md`, `PROGRESS.md` |
| `docs/` | All project documents in numbered subfolders (standards, project, requirements, architecture, testing, operations) | `docs/AGENTS.md` (covers all subfolders) |
| `docs/deliverables/` | DOCX, PDF, and PPTX outputs of the current revision, to upload to Google Drive. `source/` has the build script (docx-js), diagram sources, the mood board image, and `md2html.py` (Markdown to HTML for Google Doc tabs). | `docs/AGENTS.md` |
| `system/` | The actual system. Contains `frontend/` and `backend/`. No documents (D-28). | Folder `AGENTS.md` files |
| `system/frontend/` | Ionic Angular app with the Android platform (created in S1) | `system/frontend/AGENTS.md` |
| `system/backend/` | Supabase backend: migrations, seed, API contract, L2 tests, operation scripts (created in S1) | `system/backend/AGENTS.md` |
| `.github/workflows/` | `ci.yml` (lint, L1, L2 on each push), `keepalive.yml` (keep-alive source A) | `system/backend/AGENTS.md` |

## 4. Mandatory rules for agents

1. Write all documents, agent notes, and code comments in ASD-STE100. Code, commands, file names, and IDs are exempt.
2. Do not change or reuse a published ID (requirement, test, decision, defect). To remove an item, mark it "Deleted" and give the reason.
3. Record each architecture, tool, or scope decision in `docs/01-project/decision-log.md`.
4. Obey the stage gates in `docs/05-testing/test-plan.md`. Do not start a new stage before the gate of the current stage passes.
5. A task is complete only when its tests pass. Record the result in `PROGRESS.md`.
6. When you add, move, or delete a file, update the folder map in the nearest `AGENTS.md` file (root, `docs/`, `system/frontend/`, or `system/backend/`). Do not add `AGENTS.md` files to subfolders (D-25).
7. At the end of each session, add one entry to the session log in `PROGRESS.md`.
8. Do not write secrets (passwords, keys, tokens) in a tracked file. Put secrets in `.env` files. Do not commit `.env` files.
9. If a document and the code do not agree, stop. Record the problem in `PROGRESS.md` under "Open issues". Then ask the user.
10. Mobile functions for OJT and facilitator must operate offline. Admin functions can need a network connection.
11. Do not do work that is not in a requirement. If a new function is necessary, write the requirement first.
12. At the start of each session, make sure that the Supabase projects are active. If a project is paused, do procedure A of `docs/07-operations/free-tier-operations-runbook.md` before other work.

## 5. ID conventions

| Item | Format | Example |
|---|---|---|
| Functional requirement | `FR-<MODULE>-NN` | `FR-DTR-01` |
| Quality requirement | `QR-<CHARACTERISTIC>-NN` | `QR-RE-03` |
| Test case | `TC-<LEVEL>-<MODULE>-NN` | `TC-CI-SYNC-02` |
| Decision | `D-NN` | `D-04` |
| Open question | `Q-NN` | `Q-01` |
| Assumption | `A-NN` | `A-05` |
| Risk | `R-NN` | `R-01` |
| Defect | `DEF-NNN` | `DEF-007` |

Module codes: `AUTH`, `PROF`, `DTR`, `COR`, `RPT`, `MON`, `NOTI`, `EXP`, `ADM`, `AUD`, `SYNC`.

Test level codes: `U` (unit), `CI` (component integration), `SI` (subsystem integration), `ST` (system), `UAT` (acceptance).

Quality codes: `FS`, `PE`, `CO`, `IC`, `RE`, `SE`, `MA`, `FL`, `SF`. See `docs/02-requirements/quality-requirements-iso25010.md`.

## 6. Current state

`PROGRESS.md` is the only source for the current state. Do not copy the state into this file.

## 7. Shared outputs (Google Drive)

- Folder: https://drive.google.com/drive/u/0/folders/1HO_Jxxigs5hl_rsPjGUE1L9R7nDC7aFD (folder ID `1HO_Jxxigs5hl_rsPjGUE1L9R7nDC7aFD`)
- Contents: only the final files of the current revision batch (D-24). The primary file is the Google Doc "OJT-DTR - System Documents - Rev <n>", with one tab for each document part (D-27). DOCX, PDF, and PPTX files are copies.
- To change a Google Doc tab: update the Markdown source first, then replace the tab content. Paste HTML (made from the Markdown) into the tab with Claude in Chrome. The Drive connector cannot make tabs.
- The Markdown files in this repository are the source. Make the Drive files from them.
- Name each file `OJT-DTR - <document> - Rev <n>`. Record each upload in `PROGRESS.md`.
- Local copies: `docs/deliverables/`. To make a new revision, update the Markdown source, run `docs/deliverables/source/extract_test_cases.py`, render the Mermaid diagrams (`modmap.mmd`, `network.mmd`) to PNG, then run `node build.js`. Set `VARIANT=core3` to build only the three S0 plans (DL-01, DL-02, DL-05) as "OJT-DTR - Module, Network, and Test Plans - Rev <n>". `build.js` writes to `docs/deliverables/source/`; move the output to `docs/deliverables/`.
