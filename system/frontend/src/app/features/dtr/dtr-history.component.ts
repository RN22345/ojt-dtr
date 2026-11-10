// The DTR history list (FR-DTR-07): weeks, days, and sessions with the sync status of each punch.
// The doubtful-time flag is for the facilitator and the admin only (FR-DTR-11), so the OJT page hides it.
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonBadge, IonItem, IonLabel, IonList, IonListHeader, IonNote } from '@ionic/angular';
import { Punch } from '../../data/repositories/punch.repository';
import { STRINGS } from '../../shared/strings';
import { dateLabel, duration, timeOfDay } from '../../shared/utils/format';
import { HistoryWeek } from './dtr-history';

const STATUS_COLOR = { pending: 'warning', synced: 'success', issue: 'danger' } as const;

@Component({
  selector: 'app-dtr-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonList, IonListHeader, IonItem, IonLabel, IonNote, IonBadge],
  template: `
    @if (weeks().length === 0) {
      <p>{{ text.noPunches }}</p>
    }
    @for (week of weeks(); track week.weekStart) {
      <ion-list>
        <ion-list-header>
          <ion-label>{{ text.weekOf(date(week.weekStart)) }}</ion-label>
          <ion-note>{{ text.total }}: {{ duration(week.minutes) }}</ion-note>
        </ion-list-header>
        @for (day of week.days; track day.date) {
          <ion-item lines="none" class="day">
            <ion-label>{{ date(day.date) }}</ion-label>
            <ion-note slot="end">{{ duration(day.minutes) }}</ion-note>
          </ion-item>
          @for (s of day.sessions; track s.timeIn.id) {
            <ion-item>
              <ion-label>
                <h3>{{ time(s.timeIn) }} – {{ s.timeOut ? time(s.timeOut) : text.open }}</h3>
                <p class="flags">
                  <ion-badge [color]="statusColor(s.timeIn)">{{ text.status[s.timeIn.syncStatus] }}</ion-badge>
                  @if (s.timeOut) {
                    <ion-badge [color]="statusColor(s.timeOut)">{{ text.status[s.timeOut.syncStatus] }}</ion-badge>
                  }
                  @if (s.missingTimeOut) {
                    <ion-badge color="danger">{{ text.missingTimeOut }}</ion-badge>
                  }
                  @if (showDoubtful() && (s.timeIn.doubtfulTime || s.timeOut?.doubtfulTime)) {
                    <ion-badge color="tertiary">{{ text.doubtfulTime }}</ion-badge>
                  }
                  @if (s.timeIn.lat === null) {
                    <ion-badge color="light">{{ text.noLocationFlag }}</ion-badge>
                  }
                </p>
              </ion-label>
              <ion-note slot="end">{{ s.timeOut ? duration(s.minutes) : '' }}</ion-note>
            </ion-item>
          }
        }
      </ion-list>
    }
  `,
  styles: `
    ion-list {
      margin-bottom: 18px;
    }
    ion-list-header {
      --padding-start: 0;
      gap: var(--space-2);
      min-height: 36px;
      padding-inline-start: 0;
      font-size: 0.875rem;
      font-weight: 600;
    }
    ion-list-header ion-label {
      margin-block: var(--space-2);
    }
    ion-note {
      flex-shrink: 0;
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
    }
    ion-item {
      --min-height: 58px;
      --padding-start: 10px;
      --inner-padding-end: var(--space-2);
      --border-color: var(--ion-color-light);
    }
    .day {
      --min-height: 36px;
      --background: var(--ion-color-light);
      --border-width: 0;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--ion-color-primary);
    }
    .day ion-label {
      margin-block: 6px;
    }
    h3 {
      font-family: var(--ion-font-family);
      font-size: 0.875rem;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }
    .flags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
      margin: 5px 0 0;
    }
    ion-badge {
      padding: 3px 7px;
    }
    ion-badge[color='success'] {
      --ion-color-base: rgba(var(--ion-color-success-rgb), 0.15);
      --ion-color-contrast: var(--ion-color-success-shade);
    }
    :host > p {
      margin: var(--space-3) 0;
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--ion-color-medium-shade);
    }
  `,
})
export class DtrHistoryComponent {
  readonly weeks = input.required<HistoryWeek[]>();
  /** FR-DTR-11: true on the facilitator view only. */
  readonly showDoubtful = input(false);

  protected readonly text = STRINGS.dtr;
  protected readonly date = dateLabel;
  protected readonly duration = duration;

  protected time(p: Punch): string {
    return timeOfDay(p.deviceTime);
  }

  protected statusColor(p: Punch): string {
    return STATUS_COLOR[p.syncStatus];
  }
}
