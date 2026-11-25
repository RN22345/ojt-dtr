// FR-MON-01: logged, approved, and remaining hours, and the percent complete (A-06).
import { PunchInput, buildSessions, minutesByDate } from './hours';

/** A punch with its approval flag. The server sets the flag when a facilitator approves the week (FR-RPT-07). */
export interface ProgressPunch extends PunchInput {
  approved: boolean;
}

export interface ProgressTotals {
  requiredMinutes: number;
  loggedMinutes: number;
  approvedMinutes: number;
  remainingMinutes: number;
  /** Approved minutes as a percent of the required minutes (0 to 100, whole number). */
  percent: number;
  /** Logged minutes as a percent of the required minutes (0 to 100, whole number). */
  loggedPercent: number;
}

/** Logged and approved minutes for each date. A work session counts as approved when its time-in is approved. */
export function dailyMinutesSplit(punches: readonly ProgressPunch[]): {
  daily: Record<string, number>;
  approvedDaily: Record<string, number>;
} {
  const approved = new Set(punches.filter((p) => p.approved).map((p) => p.id));
  const sessions = buildSessions(punches);
  return {
    daily: Object.fromEntries(minutesByDate(sessions)),
    approvedDaily: Object.fromEntries(minutesByDate(sessions.filter((s) => approved.has(s.timeIn.id)))),
  };
}

/** Only approved minutes count toward the required hours (A-06). */
export function progressTotals(
  requiredHours: number,
  dailyMinutes: Record<string, number>,
  approvedDailyMinutes: Record<string, number>,
): ProgressTotals {
  const requiredMinutes = Math.max(0, requiredHours) * 60;
  const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
  const loggedMinutes = sum(dailyMinutes);
  const approvedMinutes = sum(approvedDailyMinutes);
  const pct = (m: number) => (requiredMinutes ? Math.min(100, Math.round((m / requiredMinutes) * 100)) : 0);
  return {
    requiredMinutes,
    loggedMinutes,
    approvedMinutes,
    remainingMinutes: Math.max(0, requiredMinutes - approvedMinutes),
    percent: pct(approvedMinutes),
    loggedPercent: pct(loggedMinutes),
  };
}
