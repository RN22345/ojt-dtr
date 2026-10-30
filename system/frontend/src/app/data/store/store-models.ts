// View models of the mobile screens (S3). The work store makes them from the repositories.
// They keep the shapes of the UI prototype (D-63), so that the pages did not need a new layout.
import { ReportStatus } from '../../shared/utils/report-rules';
import { SyncStatus } from '../repositories/punch.repository';

export type { ReportStatus } from '../../shared/utils/report-rules';
export type CorrectionStatus = 'pending' | 'approved' | 'rejected';
export type CorrectionKind = 'add' | 'change';

/** FR-RPT-08: one status change of a report. `by` is the name of the person. */
export interface ReportHistoryEntry {
  at: string;
  status: ReportStatus;
  by: string;
  remark?: string;
}

export interface WeeklyReport {
  id: string;
  ojtId: string;
  /** The Monday of the week (YYYY-MM-DD). */
  weekStart: string;
  tasksDone: string;
  skillsLearned: string;
  problems: string;
  plansNextWeek: string;
  /** The number of photos of the report on the server and on this device (FR-RPT-03). */
  photoCount: number;
  status: ReportStatus;
  history: ReportHistoryEntry[];
  updatedAt: string;
  syncStatus: SyncStatus | 'none';
}

export interface CorrectionRequest {
  id: string;
  ojtId: string;
  kind: CorrectionKind;
  punchType: 'in' | 'out';
  /** The date of the punch (YYYY-MM-DD, Asia/Manila). */
  date: string;
  /** The time of the original punch (HH:mm), for kind `change`. */
  originalTime?: string;
  /** The requested time (HH:mm). */
  requestedTime: string;
  reason: string;
  status: CorrectionStatus;
  remark?: string;
  createdAt: string;
  decidedAt?: string;
  syncStatus: SyncStatus;
}

/** An OJT with the assignment and the DTR summary (FR-PROF-01, FR-MON-01, FR-MON-02). */
export interface OjtView {
  id: string;
  fullName: string;
  email: string;
  contactNumber: string;
  companyName: string;
  facilitatorName: string;
  batchName: string;
  requiredHours: number;
  startDate: string;
  /** Logged minutes for each date (YYYY-MM-DD) from the closed work sessions. */
  dailyMinutes: Record<string, number>;
  /** Approved minutes for each date (FR-RPT-07). */
  approvedDailyMinutes: Record<string, number>;
  lastTimeIn: string | null;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link: string;
}

export interface HoursProgress {
  requiredMinutes: number;
  loggedMinutes: number;
  approvedMinutes: number;
  remainingMinutes: number;
  /** Approved hours as a percent of the required hours (0 to 100). */
  percent: number;
  /** Logged hours as a percent of the required hours (0 to 100). */
  loggedPercent: number;
  /** The expected last day at the mean hours of a work day, or null. */
  projectedEnd: string | null;
}

export interface DayMinutes {
  date: string;
  minutes: number;
}

/** The content of the report editor. `photos` are the new photos (data URLs) that are not saved yet. */
export interface ReportContent {
  tasksDone: string;
  skillsLearned: string;
  problems: string;
  plansNextWeek: string;
  photos: string[];
}

export type ReportActionResult =
  | { ok: true; report: WeeklyReport }
  | { ok: false; reason: 'not-editable' | 'incomplete' | 'remark-required' | 'not-found' | 'too-many-photos' };

export const MAX_REPORT_PHOTOS = 5;

/** Adds days to a date (YYYY-MM-DD). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const EMPTY_OJT: OjtView = {
  id: '',
  fullName: '',
  email: '',
  contactNumber: '',
  companyName: '',
  facilitatorName: '',
  batchName: '',
  requiredHours: 0,
  startDate: '',
  dailyMinutes: {},
  approvedDailyMinutes: {},
  lastTimeIn: null,
};
