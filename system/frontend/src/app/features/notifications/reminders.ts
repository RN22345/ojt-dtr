// Layer 1 and 4: the local reminders of the OJT (FR-NOTI-01, FR-NOTI-02; QR-CO-01).
// The times are pure rules. The scheduler uses the operating system scheduler (@capacitor/local-notifications),
// so a reminder shows offline and needs no background service. A reminder failure never stops a punch or a login.
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Capacitor, PermissionState } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { localDate, weekStart } from '../../shared/utils/hours';

/** The fixed ID of the time-out reminder (FR-NOTI-01). */
export const TIME_OUT_REMINDER_ID = 1001;
/** The fixed ID of the weekly report reminder (FR-NOTI-02). */
export const REPORT_REMINDER_ID = 1002;
/** The default time-out reminder time, in Asia/Manila (A-04). */
export const DEFAULT_TIME_OUT_REMINDER = '17:00';

/** One reminder that the operating system shows at `at`. */
export interface ReminderItem {
  id: number;
  at: Date;
  title: string;
  body: string;
}

/** The two reminder times. `null` means no reminder. */
export interface ReminderPlan {
  timeOutAt: Date | null;
  reportAt: Date | null;
}

/** The local notifications plugin, as the app uses it. A test replaces it with a fake. */
export interface LocalNotificationsPort {
  checkPermission(): Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission(): Promise<'granted' | 'denied' | 'prompt'>;
  cancel(ids: number[]): Promise<void>;
  schedule(items: ReminderItem[]): Promise<void>;
}

/** The text of the two reminders (FR-NOTI-01, FR-NOTI-02). */
const REMINDER_TEXT = {
  timeOut: { title: 'Time out', body: 'Your work session is open. Record your time-out.' },
  report: { title: 'Weekly report', body: 'Submit your weekly report for this week.' },
} as const;

const HOUR_MS = 3_600_000;

/** The time of the weekly report reminder (FR-NOTI-02). */
const REPORT_TIME = '16:00';

/** An instant from a date and an HH:mm time in Asia/Manila (fixed UTC+08:00, no daylight time; A-04). */
function manilaInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+08:00`);
}

/** The calendar date (YYYY-MM-DD) `days` after a date. The date arithmetic uses UTC, so no offset moves the day. */
function addDays(date: string, days: number): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

/**
 * FR-NOTI-01: the time-out reminder for an open work session.
 * Null if there is no open session. Else the set time on the Manila date of the time-in. If that instant is
 * not later than the time-in, the reminder is 8 hours after the time-in. A time that is not later than `now`
 * gives no reminder.
 */
export function timeOutReminderAt(openTimeIn: string | null, now: Date, at: string = DEFAULT_TIME_OUT_REMINDER): Date | null {
  if (!openTimeIn) {
    return null;
  }
  const timeIn = new Date(openTimeIn);
  const setTime = manilaInstant(localDate(timeIn), at);
  const later = setTime.getTime() > timeIn.getTime() ? setTime : new Date(timeIn.getTime() + 8 * HOUR_MS);
  return later.getTime() > now.getTime() ? later : null;
}

/**
 * FR-NOTI-02: the weekly report reminder. It is Friday 16:00 Manila of the current Manila week.
 * A submitted or approved report, or a Friday that is not later than `now`, moves the reminder to the next week.
 */
export function reportReminderAt(
  now: Date,
  weekStatus: 'draft' | 'submitted' | 'approved' | 'returned' | null,
): Date | null {
  const monday = weekStart(now);
  const friday = manilaInstant(addDays(monday, 4), REPORT_TIME);
  const done = weekStatus === 'submitted' || weekStatus === 'approved';
  const late = friday.getTime() <= now.getTime();
  return manilaInstant(addDays(monday, done || late ? 11 : 4), REPORT_TIME);
}

/** Maps the plugin permission state to the three states of the port. */
function permissionOf(state: PermissionState): 'granted' | 'denied' | 'prompt' {
  if (state === 'granted') {
    return 'granted';
  }
  return state === 'denied' ? 'denied' : 'prompt';
}

const nativePort: LocalNotificationsPort = {
  async checkPermission() {
    return permissionOf((await LocalNotifications.checkPermissions()).display);
  },
  async requestPermission() {
    return permissionOf((await LocalNotifications.requestPermissions()).display);
  },
  async cancel(ids) {
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  },
  async schedule(items) {
    await LocalNotifications.schedule({
      notifications: items.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        // D-44: an inexact alarm does not open the Android "Alarms & reminders" screen.
        isExactNotification: false,
        schedule: { at: item.at, allowWhileIdle: true },
      })),
    });
  },
};

/** The web build has no local notifications (QR-CO-01). It reports `denied` and does nothing. */
const webPort: LocalNotificationsPort = {
  checkPermission: async () => 'denied',
  requestPermission: async () => 'denied',
  cancel: async () => undefined,
  schedule: async () => undefined,
};

/** The local notifications plugin of the device. Tests replace it. */
export const LOCAL_NOTIFICATIONS = new InjectionToken<LocalNotificationsPort>('LOCAL_NOTIFICATIONS', {
  providedIn: 'root',
  factory: () => (Capacitor.isNativePlatform() ? nativePort : webPort),
});

/** Layer 4: puts a reminder plan on the operating system scheduler (FR-NOTI-01, FR-NOTI-02). */
@Injectable({ providedIn: 'root' })
export class ReminderScheduler {
  private readonly port = inject(LOCAL_NOTIFICATIONS);

  /** Cancels the old reminders, then schedules the new ones. It never throws. */
  async apply(plan: ReminderPlan): Promise<void> {
    try {
      const permission = await this.granted();
      if (!permission) {
        return;
      }
      await this.port.cancel([TIME_OUT_REMINDER_ID, REPORT_REMINDER_ID]);
      const items: ReminderItem[] = [];
      if (plan.timeOutAt) {
        items.push({ id: TIME_OUT_REMINDER_ID, at: plan.timeOutAt, ...REMINDER_TEXT.timeOut });
      }
      if (plan.reportAt) {
        items.push({ id: REPORT_REMINDER_ID, at: plan.reportAt, ...REMINDER_TEXT.report });
      }
      if (items.length) {
        await this.port.schedule(items);
      }
    } catch {
      // A reminder must never stop a punch or a login.
    }
  }

  /** Cancels both reminders. It never throws. */
  async clear(): Promise<void> {
    try {
      await this.port.cancel([TIME_OUT_REMINDER_ID, REPORT_REMINDER_ID]);
    } catch {
      // Nothing to cancel, or no plugin. The app continues.
    }
  }

  /** True if the plugin can show a notification. It requests the permission once if the state is `prompt`. */
  private async granted(): Promise<boolean> {
    let permission = await this.port.checkPermission();
    if (permission === 'prompt') {
      permission = await this.port.requestPermission();
    }
    return permission === 'granted';
  }
}
