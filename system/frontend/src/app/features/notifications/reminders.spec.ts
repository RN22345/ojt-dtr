import { TestBed } from '@angular/core/testing';
import {
  LOCAL_NOTIFICATIONS,
  LocalNotificationsPort,
  REPORT_REMINDER_ID,
  ReminderPlan,
  TIME_OUT_REMINDER_ID,
  ReminderScheduler,
  reportReminderAt,
  timeOutReminderAt,
} from './reminders';

// TC-SI-NOTI-01 (FR-NOTI-01, FR-NOTI-02, QR-CO-01), L1 part: the reminder times and the scheduler.
// The reminders use the operating system scheduler (local notifications), so they show offline.
// The device part (the reminder shows in airplane mode) is an L3 step.
// Times are UTC; Manila is UTC+08:00.
describe('TC-SI-NOTI-01 time-out reminder time (FR-NOTI-01)', () => {
  const now = new Date('2026-10-19T02:00:00Z'); // Mon 10:00 Manila

  it('TC-SI-NOTI-01 no open work session gives no reminder', () => {
    expect(timeOutReminderAt(null, now)).toBeNull();
  });

  it('TC-SI-NOTI-01 an open session from the morning gives 17:00 Manila of the same day', () => {
    expect(timeOutReminderAt('2026-10-19T00:00:00Z', now)?.toISOString()).toBe('2026-10-19T09:00:00.000Z');
  });

  it('TC-SI-NOTI-01 the set time can change', () => {
    expect(timeOutReminderAt('2026-10-19T00:00:00Z', now, '18:30')?.toISOString()).toBe('2026-10-19T10:30:00.000Z');
  });

  it('TC-SI-NOTI-01 a time-in at or after the set time gives time-in plus 8 hours', () => {
    const late = new Date('2026-10-19T10:00:00Z'); // 18:00 Manila
    expect(timeOutReminderAt('2026-10-19T09:30:00Z', late)?.toISOString()).toBe('2026-10-19T17:30:00.000Z');
  });

  it('TC-SI-NOTI-01 a reminder time in the past gives no reminder', () => {
    const evening = new Date('2026-10-19T12:00:00Z'); // 20:00 Manila
    expect(timeOutReminderAt('2026-10-19T00:00:00Z', evening)).toBeNull();
  });
});

describe('TC-SI-NOTI-01 report reminder time (FR-NOTI-02)', () => {
  it('TC-SI-NOTI-01 gives Friday 16:00 Manila of this week when the report is not submitted', () => {
    const mon = new Date('2026-10-19T02:00:00Z');
    expect(reportReminderAt(mon, null)?.toISOString()).toBe('2026-10-23T08:00:00.000Z');
    expect(reportReminderAt(mon, 'draft')?.toISOString()).toBe('2026-10-23T08:00:00.000Z');
    expect(reportReminderAt(mon, 'returned')?.toISOString()).toBe('2026-10-23T08:00:00.000Z');
  });

  it('TC-SI-NOTI-01 a submitted or approved report moves the reminder to next Friday', () => {
    const mon = new Date('2026-10-19T02:00:00Z');
    expect(reportReminderAt(mon, 'submitted')?.toISOString()).toBe('2026-10-30T08:00:00.000Z');
    expect(reportReminderAt(mon, 'approved')?.toISOString()).toBe('2026-10-30T08:00:00.000Z');
  });

  it('TC-SI-NOTI-01 after Friday 16:00 the reminder is next Friday', () => {
    const friEvening = new Date('2026-10-23T09:00:00Z'); // Fri 17:00 Manila
    expect(reportReminderAt(friEvening, null)?.toISOString()).toBe('2026-10-30T08:00:00.000Z');
    const sun = new Date('2026-10-25T15:00:00Z'); // Sun 23:00 Manila
    expect(reportReminderAt(sun, 'draft')?.toISOString()).toBe('2026-10-30T08:00:00.000Z');
  });
});

describe('TC-SI-NOTI-01 reminder scheduler', () => {
  let calls: { op: string; arg: unknown }[];
  let permission: 'granted' | 'denied' | 'prompt';
  let port: LocalNotificationsPort;

  beforeEach(() => {
    calls = [];
    permission = 'granted';
    port = {
      async checkPermission() {
        calls.push({ op: 'check', arg: null });
        return permission;
      },
      async requestPermission() {
        calls.push({ op: 'request', arg: null });
        return permission;
      },
      async cancel(ids: number[]) {
        calls.push({ op: 'cancel', arg: ids });
      },
      async schedule(items) {
        calls.push({ op: 'schedule', arg: items });
      },
    };
    TestBed.configureTestingModule({ providers: [{ provide: LOCAL_NOTIFICATIONS, useValue: port }] });
  });

  const plan: ReminderPlan = {
    timeOutAt: new Date('2026-10-19T09:00:00Z'),
    reportAt: new Date('2026-10-23T08:00:00Z'),
  };

  it('TC-SI-NOTI-01 cancels the old reminders, then schedules both with fixed IDs', async () => {
    await TestBed.inject(ReminderScheduler).apply(plan);
    expect(calls[calls.length - 2]).toEqual({ op: 'cancel', arg: [TIME_OUT_REMINDER_ID, REPORT_REMINDER_ID] });
    const last = calls[calls.length - 1];
    expect(last.op).toBe('schedule');
    const items = last.arg as { id: number; at: Date; title: string; body: string }[];
    expect(items.map((i) => i.id)).toEqual([TIME_OUT_REMINDER_ID, REPORT_REMINDER_ID]);
    expect(items[0].at.toISOString()).toBe('2026-10-19T09:00:00.000Z');
    expect(items[1].at.toISOString()).toBe('2026-10-23T08:00:00.000Z');
    for (const i of items) {
      expect(i.title.length).toBeGreaterThan(0);
      expect(i.body.length).toBeGreaterThan(0);
    }
  });

  it('TC-SI-NOTI-01 a null time schedules only the other reminder', async () => {
    await TestBed.inject(ReminderScheduler).apply({ timeOutAt: null, reportAt: plan.reportAt });
    const last = calls[calls.length - 1];
    expect((last.arg as { id: number }[]).map((i) => i.id)).toEqual([REPORT_REMINDER_ID]);
  });

  it('TC-SI-NOTI-01 no reminders: cancel only, no schedule call', async () => {
    await TestBed.inject(ReminderScheduler).apply({ timeOutAt: null, reportAt: null });
    expect(calls.some((c) => c.op === 'schedule')).toBe(false);
    expect(calls.some((c) => c.op === 'cancel')).toBe(true);
  });

  it('TC-SI-NOTI-01 a denied permission schedules nothing and does not throw', async () => {
    permission = 'denied';
    await expect(TestBed.inject(ReminderScheduler).apply(plan)).resolves.toBeUndefined();
    expect(calls.some((c) => c.op === 'schedule')).toBe(false);
  });

  it('TC-SI-NOTI-01 a plugin failure does not throw (a reminder must never stop a punch)', async () => {
    port.schedule = async () => {
      throw new Error('plugin not available');
    };
    await expect(TestBed.inject(ReminderScheduler).apply(plan)).resolves.toBeUndefined();
  });
});
