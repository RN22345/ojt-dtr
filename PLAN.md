# PLAN: OJT-DTR (LogBound)
Status values: todo | active | done | escalated

Source of the stage scope and gate criteria: `docs/05-testing/test-plan.md`, section 8. Project state: `PROGRESS.md`.

## M0: existing baseline
- Status: done
- S0 to S3 gates passed (2026-10-25 and 2026-11-10). Offline DTR and sync, reports, corrections, facilitator views, and admin web exist on Ionic/Angular + Capacitor with Supabase `dev`.
- The LogBound redesign is merged into `main` (PR #7, `ba458c4`). CI passes on `ba458c4`.

## M1: S4 functions (MON, NOTI, EXP, AUD views)
- Status: todo
- Goal: Complete the S4 test items: progress calculation, notifications, DTR and report export (PDF and CSV), and the audit views. Each function has its L1, L2, and L3 tests.
- foreman: opus
- Routing reason: EXP and NOTI can need backend functions and plugin changes, which are protected areas.
- Acceptance tests: TC-U-MON-01, TC-CI-EXP-01, TC-CI-EXP-02, TC-SI-NOTI-01 (`docs/05-testing/test-cases.md`)
- Protected areas involved: possibly `system/backend/supabase/migrations/*`, `system/backend/supabase/functions/*`, `system/frontend/src/app/data/*`

## M2: S4 quality tests and drills
- Status: todo
- Goal: Measure each quality requirement: all TC-ST-OJT-*, TC-ST-FAC-*, TC-ST-ADM-*, and TC-ST-Q-* test cases, including the pause drill (TC-ST-Q-RE-03) and the rebuild drill (TC-ST-Q-RE-04, decide BK-01 first).
- foreman: opus
- Routing reason: Device, dashboard, and drill steps need the user and the orchestrator; builders only fix the defects found.
- Acceptance tests: TC-ST-* (S4 rows in `docs/05-testing/test-cases.md`)
- Protected areas involved: none planned (defect fixes can touch any area)

## M3: S4 test report and gate
- Status: todo
- Goal: Write `docs/05-testing/reports/S4-test-report.md` from the template. Each quality requirement has a measured result. Each "Must" QR passes, or the user accepts a waiver in the decision log.
- foreman: opus
- Routing reason: Gate decisions belong to the orchestrator and the user.
- Acceptance tests: S4 exit criteria, `docs/05-testing/test-plan.md` section 8
- Protected areas involved: none
