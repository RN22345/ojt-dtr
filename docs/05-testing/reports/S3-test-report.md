# Stage test report: S3 Reports, corrections, and admin web

This report gives the results of the S3 tests and the status of the S3 gate. It is a draft. The S3 work started before the S1 and S2 gates (D-65). Thus the S3 gate cannot pass before the S1 and S2 gates pass. Update this report at the gate check (S3 end date 2026-11-14).

## 1. Summary

| Item | Value |
|---|---|
| Stage | S3 |
| Dates | 2026-11-11 to 2026-11-14 (work started 2026-10-30, D-65). Tests ran on 2026-10-30 and 2026-11-08. |
| Build or commit | `bfbf648` and earlier on the branch `s3/reports-corrections-admin` (not merged into `main`) |
| Gate result | Fail for now (not passed yet). Draft. Open items: the S1 and S2 gates (section 8). All S3 test cases are run. |
| Prepared by | Claude Code (desktop), for the developer |

Test devices:

- Two Android 15 emulators (two read-only instances of the AVD `ojt_dtr_api35`), development build. `ojt1` ran on `emulator-5554`. `fac1` ran on `emulator-5556`. The user logged in on both devices.
- PC with Node.js for the L2 tests and the unit tests.
- Browser preview on a desktop screen for the admin web tests (seed admin).
- Supabase project `dev`.

## 2. Test execution

| Level | Planned | Run | Pass | Fail | Blocked | Not run |
|---|---|---|---|---|---|---|
| L1 Unit | 3 | 3 | 3 | 0 | 0 | 0 |
| L2 Component integration | 5 | 5 | 5 | 0 | 0 | 0 |
| L3 Subsystem integration | 2 | 2 | 2 | 0 | 0 | 0 |
| L4 System | 4 | 4 | 3 (1 part pass) | 0 | 0 | 0 |
| L5 Acceptance | 0 | 0 | 0 | 0 | 0 | 0 |

The part pass is TC-ST-ADM-01: the S3 part passes. The CSV export (FR-EXP-03) is S4 work.

Automated test totals on 2026-11-08:

- Backend L2: 119 of 119 pass in the full run (11 files). This run does not include the DEF-018 test.
- After the DEF-018 fix: the admin and ACL files, 43 of 43 pass.
- Frontend unit tests: 256 of 256 pass.

### 2.1 Level 1: unit tests

| Test case | Title | Result |
|---|---|---|
| TC-U-RPT-01 | Report status machine | Pass. The tests are in `system/frontend/src/app/shared/utils/report-rules.spec.ts`. |
| TC-U-RPT-02 | Report hours | Pass. The tests are in `system/frontend/src/app/shared/utils/report-rules.spec.ts`. |
| TC-U-COR-01 | Approved correction | Pass (2026-11-09). Only the server function `push_correction` makes the correction punch, so this case runs in the L2 test of TC-CI-AUD-01 in `system/backend/tests/reports-corrections.test.ts` (D-71). The test name has both IDs. |

### 2.2 Level 2: component integration tests

| Test case | Title | Result |
|---|---|---|
| TC-CI-ACL-02 | Facilitator data scope | Pass. The client part and the server move of `ojt5` pass (2026-10-30). |
| TC-CI-RPT-01 | Approval approves the week | Pass (2026-10-30) |
| TC-CI-RPT-02 | First decision wins | Pass (2026-10-30) |
| TC-CI-ADM-01 | Admin data endpoints | Pass (2026-11-08). The Edge Function part of TC-CI-ACL-03 also passes. |
| TC-CI-AUD-01 | Audit entries | Pass (2026-10-30) |

NOTE: The audit entry of a new account has no actor, because the `auth.users` trigger makes the profile. This is a known limit (`PROGRESS.md`, S3 next, item 3).

### 2.3 Level 3: subsystem integration tests (two emulators)

The log of the test run is the source of the times in this section. All times are local times of 2026-11-08. Network conditions: N1 online, N2 offline (airplane mode), N3 offline to online (test plan, section 10).

| Test case | Title | Result |
|---|---|---|
| TC-SI-RPT-01 | Two-device report cycle | Pass in N1, N2, and N3. See the steps below. |
| TC-SI-COR-01 | Two-device correction cycle | Pass in N1 and N2. See the steps below. |

Steps of TC-SI-RPT-01 (report week 2026-10-26):

| Time | Step |
|---|---|
| 21:06:44 | Airplane mode on, `emulator-5554` (`ojt1`). N2 starts. |
| 21:07:24 | Offline: the OJT taps "Save draft". |
| 21:07:38 to 21:07:45 | Offline: the OJT taps "Submit" and confirms. |
| 21:07:56 | Airplane mode off. N3. |
| 21:11:02 to 21:11:19 | The facilitator returns the report with a remark and confirms. The first tap on the confirm button missed, and the second tap worked. |
| 21:11:32 | The OJT device gets the change with `sync.trigger()`. |
| 21:11:59 | The OJT changes the report and submits it again (online). |
| 21:12:15 to 21:12:35 | The facilitator pulls, approves, and confirms. |
| 21:13:25 | The status is correct on both devices. |

Server state that the orchestrator examined on 2026-11-08:

- `ojt1`, week 2026-10-26: status `approved`, version 6. The report events are submit, return, submit, approve, in this order.
- 473 of 473 punches of that week have `approved = true`.

NOTE: At 21:08:37 the facilitator device (`emulator-5556`) showed the login screen. The email field showed `admin@test.local` and the error "account cannot use this app". The `fac1` session was no longer active. Cause: the user did the mobile check of TC-ST-ACC-01 (admin login) on this device, as the orchestrator asked. The login before the check ended the `fac1` session. This is not a defect. The user logged `fac1` in again, and the test continued at 21:10:26.

Steps of TC-SI-COR-01 (corrections of 2026-11-03):

| Time | Step |
|---|---|
| 21:13:25 | Airplane mode on, `emulator-5554`. N2 starts. |
| 21:14:01 | Offline: the OJT sends correction 1 (kind add, time-in 09:00). |
| 21:14:17 | Offline: the OJT sends correction 2 (kind add, time-out 12:00). |
| 21:14:22 | Airplane mode off. N3. |
| 21:15:07 | The facilitator approves the time-out correction. |
| 21:15:15 | The facilitator approves the time-in correction. |
| 21:15:29 to 21:15:47 | The OJT pulls. The two new punches show on the OJT device. |

Server state: 2 corrections `approved` (kind add). The server made 2 new punches on 2026-11-03, a time-in at 09:00 and a time-out at 12:00 (D-66).

### 2.4 Level 4: system tests

| Test case | Title | Result |
|---|---|---|
| TC-ST-FAC-01 | Facilitator review offline | Pass in N1, N2, and N3 (two emulators). See the steps below. |
| TC-ST-ADM-01 | Admin full cycle | Part pass. The S3 part passes (browser preview, N1). The CSV export (FR-EXP-03) is S4 work. |
| TC-ST-ADM-02 | Admin web app offline | Pass. The offline state was simulated with the browser `offline` and `online` events. The web app showed the offline message, disabled the save buttons, and kept the form values. |
| TC-ST-ACC-01 | Role and platform access | Pass (2026-11-10). See below. |

Steps of TC-ST-FAC-01:

| Time | Step |
|---|---|
| 21:15:47 | The OJT is online. The OJT sends the report of 2026-10-19 and the report of 2026-10-12 for review. |
| 21:16:17 | The OJT sends correction 3 (kind add, time-in 08:30, 2026-11-04), online. |
| 21:16:43 | Airplane mode on, `emulator-5556` (`fac1`), before the decisions. N2 starts. |
| 21:17:24 | Offline: the facilitator opens the DTR of all 5 OJTs. The app shows "No network". |
| 21:17:38 | Offline: the facilitator approves the report of 2026-10-12. |
| 21:17:47 | Offline: the facilitator returns the report of 2026-10-19 with a remark. |
| 21:17:57 | Offline: the facilitator rejects correction 3 with a remark. |
| 21:18:16 | Airplane mode off on `emulator-5556`. N3. |
| 21:18:49 | The OJT pulls. The decisions show on the OJT device. |

Server state: the report of 2026-10-12 is `approved` (events submit, approve). The report of 2026-10-19 is `returned` (events submit, return). Correction 3 is `rejected` with a remark.

TC-ST-ACC-01 details:

| Part | Result |
|---|---|
| A typed URL of another role is blocked (web app) | Pass. The admin typed `/ojt/home` and `/facilitator/home`. The app went back to `/admin/dashboard`. |
| Admin login on the mobile app fails | Pass. The mobile app refuses the admin login with the message "This account cannot use this app. OJT and facilitator accounts use the mobile app. Admin accounts use the web app." |
| OJT login on the web app fails | Pass (2026-11-10). The user logged in as `ojt1` in the browser preview. The web app refused the login with the same message. |

NOTE: The browser tests of the admin web found DEF-017 and DEF-018. Section 6 gives the details.

Sync bar check: after the device tests, a query of the sync bar first hit a stale hidden page. The visible bar updated in less than 0.3 s with the report sync status. This is not a defect. A last draft edit of the report of 2026-10-19 (the "problems" field) synced to the server.

## 3. Common gate rules (test plan, section 7)

| Rule | Result | Evidence |
|---|---|---|
| G1 All planned test cases run | Yes | 14 of 14 run (section 2) |
| G2 "Must" test cases pass | Yes | All "Must" cases pass. The CSV part of TC-ST-ADM-01 (FR-EXP-03, "Should") is S4 work. |
| G3 Zero open S1 and S2 defects | Yes | Section 6, `defect-log.md` |
| G4 Lint, type check, and builds pass | Yes | Lint 0 errors. The frontend build passes. |
| G5 Regression suites pass | Part | The automated suites pass: frontend 256 of 256, backend 119 of 119 (and 43 of 43 after DEF-018). The L3 and L4 test cases of S1 and S2 are not run again yet (test plan, section 9). Do this at the gate check. |
| G6 Coverage meets QR-MA-05 | Yes | Backend 92.4% of the rule items (73 of 79, D-52), target 70%. Frontend line coverage 80.3% (2026-11-09), target 60%. `data/sync` 92.3%, `core/auth` 93.8%, `shared/utils` (DTR calculation) 87.4%, target 80%. |
| G7 This report exists | Draft | This file |
| G8 `PROGRESS.md` updated | No | The test results are recorded. The gate result is recorded at the gate check. |
| G9 Keep-alive check passes | No | KA-01: keep-alive source B does not exist (D-45). See section 8. |

## 4. Stage exit criteria (test plan, section 8)

| Criterion | Result | Evidence |
|---|---|---|
| S2 gate passed (entry criterion) | No | S3 work started early (D-65). The S2 gate waits for the S1 gate. |
| Common gate rules | No | G8 and G9 (section 3) |
| The report cycle passes in N1, N2, and N3 | Yes | TC-SI-RPT-01 (section 2.3). TC-ST-FAC-01 also passes in N1, N2, and N3. |
| The access matrix tests pass 100% | Yes | TC-ST-ACC-01, TC-CI-ACL-02, and the Edge Function part of TC-CI-ACL-03 pass. |

## 5. Quality measures in this stage

| QR ID | Target | Measured value | Pass or fail |
|---|---|---|---|
| QR-MA-05 | Coverage: backend 70% | Backend 92.4% of the rule items (73 of 79, D-52). Frontend value for S3: not measured in this draft. | Pass (backend) |
| QR-SE-01 | Each user reads and sends only own scope | TC-CI-ACL-02 (pass). TC-ST-ACC-01 (pass). | Pass |
| QR-SF-03 | No silent delete of local changes | D-69: the device keeps the records that have a local change when the scope changes. Examined in TC-CI-ACL-02 (client part). | Pass |

NOTE: The test plan does not set a quality measure for S3 other than the items above. The S4 report gives the full quality results.

## 6. Defects

| Severity | Found | Closed | Open |
|---|---|---|---|
| S1 | 0 | 0 | 0 |
| S2 | 1 | 1 | 0 |
| S3 | 0 | 0 | 0 |
| S4 | 1 | 1 | 0 |

| ID | Severity | Summary |
|---|---|---|
| DEF-017 | S2 | Each admin web page showed only about 56 px of its content. The frame element `app-admin-page` was a block element, so `ion-content` got no height. Fix: the frame is a flex column that fills the page (`c5f4f1c`). Checked again in the browser preview: all six pages show their full content. |
| DEF-018 | S4 | When the session of the admin ended, "New user" showed "Only an active admin can do this." The function `admin-users` gave the same `forbidden` code for an ended session and for a user that is not an admin. Fix: HTTP 401 `session_ended`, and the admin web shows "Your session ended. Log out, then log in again." (`777bd88`). A new L2 test and a unit test pass. |

The device tests (TC-SI-RPT-01, TC-SI-COR-01, TC-ST-FAC-01) found zero defects.

NOTE: A CI run ended the browser session of the seed admin, because the admin tests used a global sign-out. The admin tests now sign out with the local scope (`167b5f6`). This was a test fault, not a product defect.

## 7. Skipped tests and limits

Limits and open test items:

1. Done 2026-11-09: TC-U-COR-01 runs in the L2 test of TC-CI-AUD-01 (D-71).
2. Done 2026-11-10: the web part of TC-ST-ACC-01 passes.
3. The emulator keyboard does not open (`hw.keyboard=no`). The test script set the text fields and started the pull (`sync.trigger()`) through the DevTools protocol. Thus the typing of text by hand is not tested on the emulator.
4. Pull-to-refresh is not tested. The OJT and facilitator devices pulled with `sync.trigger()`.
5. The user did the logins on the devices. At 21:08:37 the `fac1` session ended because of the TC-ST-ACC-01 admin check on that device (section 2.3). The facilitator device was logged in again before the test continued at 21:10:26.
6. All device tests ran on the emulator. Run the S3 device tests again on a real phone in S4.
7. The CSV export part of TC-ST-ADM-01 (FR-EXP-03) is S4 work.
8. The offline state in TC-ST-ADM-02 was simulated with the browser `offline` and `online` events. It was not a network cut of the PC.
9. Test data stays on `dev`: `ST-ADM Test Company`, `ST-ADM Test Batch`, `ST-ADM Test OJT` and its assignment. `ojt1` has the reports of 2026-10-12 and 2026-10-26 `approved`, the report of 2026-10-19 `returned`, and 3 corrections.

Observations (not defects now):

| # | Observation | Proposed action |
|---|---|---|
| 1 | The facilitator review list shows the time of the first submit after a resubmit. | Decide if the list must show the time of the last submit. If yes, record a defect. |
| 2 | The app accepts a report for a week with 0 hours. No rule blocks it. | Decide if a rule is necessary. If yes, write the requirement first (`AGENTS.md`, rule 11). |
| 3 | The admin user list shows no email. | Decide in S4 if the list must show the email. |
| 4 | The first part week of a batch that starts after Monday is not a late-report week (D-70). | Examine this rule at the S4 review of the dashboard. |

## 8. Decision

The S3 gate does not pass yet. This is a draft. The S3 gate waits for these actions:

1. The S1 gate passes (S1 report, section 5). KA-01 is open: keep-alive source B does not exist (D-45), so TC-ST-Q-RE-05 does not pass. On 2026-11-09 the user put the decision about source B (cron-job.org) on hold.
2. The S2 gate passes (S2 report, section 8). It waits for the S1 gate.
3. At the gate check, run the regression suites again, including the L3 and L4 test cases of S1 and S2. Then update this report and `PROGRESS.md`.

New gate date: the S3 end date, 2026-11-14, or earlier when items 1 and 2 are done.
