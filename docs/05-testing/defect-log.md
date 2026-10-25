# Defect log

This document records each defect. The severity rules and the procedure are in `test-plan.md`, section 11.

## Status values

`Open`, `In work`, `Fixed` (fix done, test not run again), `Closed` (test passed), `Deferred` (accepted for a later release, needs a decision).

## Defects

| ID | Date | Test case | Severity | Module | Summary | Device and network | Status | Fix commit |
|---|---|---|---|---|---|---|---|---|
| DEF-001 | 2026-10-25 | TC-ST-REV-01 | S3 | DTR | FR-DTR-09 and TC-U-DTR-03 marked a correct session across midnight (TC-U-UTIL-03) as "Missing time-out". Fixed by D-37. | Document review | Closed | Not in git yet |
| DEF-002 | 2026-10-25 | TC-ST-REV-01 | S3 | AUTH | QR-SE-03 said "sign-out revokes the session", but FR-AUTH-05 permits an offline sign-out. Fixed: an offline sign-out removes the tokens from the device. | Document review | Closed | Not in git yet |
| DEF-003 | 2026-10-25 | TC-ST-REV-02 | S3 | AUTH | The design did not say where FR-AUTH-03 is enforced. The server cannot know the client platform. Fixed by D-38 and system modules, section 6.1. | Document review | Closed | Not in git yet |
| DEF-004 | 2026-10-25 | TC-ST-REV-02 | S3 | COR, RPT | QR-SE-06 needs the device ID on each decision. `correction_requests` and `report_events` had no device ID. Fixed in the data model. | Document review | Closed | Not in git yet |
| DEF-005 | 2026-10-25 | TC-ST-REV-02 | S4 | ADM | The network document named a table `company_settings`. The data model keeps the settings in `companies`. Fixed in the network document. | Document review | Closed | Not in git yet |
| DEF-007 | 2026-10-25 | TC-CI-AUTH-01 | S2 | AUTH | A used refresh token still gives a new session 11 s after use. QR-SE-03 needs reuse detection. Likely cause: the `dev` Auth settings are the Supabase defaults. `supabase/config.toml` is not pushed yet (needs `supabase login`). | Vitest on PC, `dev`, N1 | Open | |
| DEF-006 | 2026-10-25 | TC-ST-REV-02 | S4 | All | The traceability table did not show the module-wide references of TC-UAT-OJT-01 and TC-UAT-ADM-01. Fixed with a NOTE in the table. | Document review | Closed | Not in git yet |

## Defect detail template

Copy this block for each S1 or S2 defect.

```
### DEF-NNN: <summary>
- Test case:
- Severity:
- Device, OS, app version:
- Network condition (N1 to N7):
- Steps:
  1.
- Expected result:
- Actual result:
- Cause (after analysis):
- Fix:
- Regression tests run:
```
