// Layer 0: weekly report rules (FR-RPT-02, FR-RPT-04 to FR-RPT-06). The server applies the same rules in sync_push.
import { PunchInput, buildSessions, minutesByWeek } from './hours';

export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'returned';
export type ReportAction = 'submit' | 'approve' | 'return';

/** Permitted status changes (TC-U-RPT-01). All other changes are rejected. */
const TRANSITIONS: Readonly<Record<ReportStatus, Partial<Record<ReportAction, ReportStatus>>>> = {
  draft: { submit: 'submitted' },
  returned: { submit: 'submitted' },
  submitted: { approve: 'approved', return: 'returned' },
  approved: {},
};

/** The status after the action, or null if the action is not permitted in this status. */
export function nextStatus(status: ReportStatus, action: ReportAction): ReportStatus | null {
  return TRANSITIONS[status][action] ?? null;
}

/** FR-RPT-06: the OJT can change the content only when the status is `draft` or `returned`. */
export function canEditReport(status: ReportStatus): boolean {
  return status === 'draft' || status === 'returned';
}

/** The sections that must have text before a submit (the server cause `incomplete`). */
export function isCompleteForSubmit(content: { tasksDone: string; skillsLearned: string }): boolean {
  return content.tasksDone.trim() !== '' && content.skillsLearned.trim() !== '';
}

/** FR-RPT-05: a return needs a remark. An approval does not. */
export function needsRemark(action: ReportAction): boolean {
  return action === 'return';
}

/** FR-RPT-02 (TC-U-RPT-02): the logged minutes of one week (Monday, YYYY-MM-DD) from the DTR. */
export function reportWeekMinutes(punches: readonly PunchInput[], week: string): number {
  return minutesByWeek(buildSessions(punches)).get(week) ?? 0;
}
