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
          <div class="day-card">
            <ion-item lines="none" class="day">
              <ion-label>{{ date(day.date) }}</ion-label>
              <ion-note slot="end">{{ duration(day.minutes) }}</ion-note>
            </ion-item>
            @for (s of day.sessions; track s.timeIn.id) {
              <ion-item lines="none" class="session">
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
          </div>
        }
      </ion-list>
    }
  `,
  styles: `
    ion-list {
      padding: 0;
      margin-bottom: 18px;
    }
    ion-list-header {
      --padding-start: 0;
      padding-inline-start: 0;
      min-height: 28px;
      font-size: 0.8125rem;
      font-family: var(--ion-font-family);
      font-weight: 700;
      color: var(--ion-color-dark);
      gap: 8px;
    }
    ion-list-header ion-label {
      margin-block: 4px;
    }
    ion-note {
      flex-shrink: 0;
      font-size: 0.6875rem;
      color: var(--ion-color-medium);
      font-variant-numeric: tabular-nums;
    }
    ion-item {
      --min-height: 0;
      --padding-start: 8px;
      --inner-padding-end: 8px;
    }
    .day-card {
      margin-bottom: 9px;
      border: 1px solid var(--lb-panel-border);
      border-radius: 11px;
      background: var(--lb-panel);
    }
    .day {
      border-bottom: 1px solid var(--lb-panel-border);
      font-size: 0.75rem;
      font-weight: 700;
      --color: var(--ion-color-primary);
    }
    .day ion-label {
      margin-block: 4px;
    }
    ion-item ion-note[slot='end'] {
      align-self: auto;
      margin: 4px 0 4px 5px;
      padding: 0;
    }
    .session + .session { border-top: 1px solid var(--lb-panel-border); }
    .session ion-label { margin-block: 5px; }
    .session h3 {
      font-family: var(--ion-font-family);
      font-size: 0.75rem;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }
    .flags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin: 5px 0 0;
    }
    ion-badge {
      padding: 3px 7px;
      font-size: 0.625rem;
      font-weight: 600;
      border-radius: 5px;
    }
    ion-badge.ion-color-success {
      background: var(--lb-online);
      color: var(--ion-color-success-shade);
    }
    ion-badge.ion-color-light {
      background: var(--lb-panel-border);
      color: var(--ion-color-dark);
    }
    :host > p {
      margin: 12px 0;
      font-size: 0.8125rem;
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
