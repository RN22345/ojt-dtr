// Layer 4: the reminder plan of the OJT (FR-NOTI-01, FR-NOTI-02). It reads the app state and gives the plan
// to the scheduler. A reminder failure never stops a punch or a login (QR-CO-01).
import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth/auth.service';
import { WorkStore } from '../data/store/work-store.service';
import { weekStart } from '../shared/utils/hours';
// The DTR service owns the open-session rule (D-51). This core service uses it.
import { DtrService } from '../features/dtr/dtr.service';
import { ReminderPlan, ReminderScheduler, reportReminderAt, timeOutReminderAt } from '../features/notifications/reminders';

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly auth = inject(AuthService);
  private readonly dtr = inject(DtrService);
  private readonly store = inject(WorkStore);
  private readonly scheduler = inject(ReminderScheduler);

  /** FR-NOTI-01, FR-NOTI-02: schedules the reminders for the current state. It never throws. */
  async refresh(now: Date = new Date()): Promise<void> {
    try {
      const profile = this.auth.profile();
      if (!profile || profile.role !== 'ojt') {
        return;
      }
      const open = await this.dtr.currentOpenSession(profile.id, now);
      const status = this.store.report(profile.id, weekStart(now))?.status ?? null;
      const plan: ReminderPlan = {
        timeOutAt: timeOutReminderAt(open ? String(open.timeIn.time) : null, now),
        reportAt: reportReminderAt(now, status),
      };
      await this.scheduler.apply(plan);
    } catch {
      // A reminder must never stop a punch or a login.
    }
  }

  /** Cancels both reminders. It never throws. */
  async clear(): Promise<void> {
    try {
      await this.scheduler.clear();
    } catch {
      // Nothing to cancel, or no plugin. The app continues.
    }
  }
}
