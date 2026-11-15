// OJT DTR page (FR-DTR-01, FR-DTR-02, FR-DTR-06, FR-DTR-07, FR-SYNC-03). The time-in is one tap on this tab
// (QR-FS-03). The punch is saved offline first (system modules 5.1). Pull down to sync (FR-SYNC-03).
import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { IonButton, IonContent, IonIcon, IonRefresher, IonRefresherContent, IonSpinner, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { calendarOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth/auth.service';
import { SyncService } from '../../data/sync/sync.service';
import { GEOLOCATION } from '../../plugins/geolocation.plugin';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { STRINGS } from '../../shared/strings';
import { dateLabel, timeOfDay } from '../../shared/utils/format';
import { localDate, PROJECT_TIME_ZONE, weekStart } from '../../shared/utils/hours';
import { HistoryWeek } from './dtr-history';
import { DtrHistoryComponent } from './dtr-history.component';
import { DtrService } from './dtr.service';

addIcons({ calendarOutline });

const monthFormat = new Intl.DateTimeFormat('en-PH', {
  timeZone: PROJECT_TIME_ZONE,
  month: 'long',
  year: 'numeric',
});
const weekdayFormat = new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', weekday: 'short' });

function workweek(now: Date) {
  const today = localDate(now);
  const monday = new Date(`${weekStart(now)}T00:00:00Z`);
  return Array.from({ length: 5 }, (_, index) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + index);
    const date = day.toISOString().slice(0, 10);
    return { date, label: dateLabel(date), weekday: weekdayFormat.format(day), number: day.getUTCDate(), today: date === today };
  });
}

@Component({
  selector: 'app-dtr-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IonContent, IonRefresher, IonRefresherContent, IonButton, IonIcon, IonSpinner, DtrHistoryComponent],
  template: `
    <app-page-header [title]="strings.pages.ojtDtr" />
    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <section class="punch" aria-live="polite">
        <div class="clock" aria-hidden="true"></div>
        <div class="punch-details">
          @if (openSince(); as time) {
            <p class="state">{{ text.openSince }}</p>
            <time class="open-time" [attr.datetime]="time">{{ time }}</time>
          } @else {
            <p class="state">{{ text.noOpenSession }}</p>
            <p class="hint">{{ text.timeInHint }}</p>
          }
          <ion-button expand="block" size="large" [color]="openSince() ? 'medium' : 'primary'" [disabled]="busy()" (click)="punch()">
            @if (busy()) {
              <ion-spinner name="dots" />
            } @else {
              {{ openSince() ? text.timeOut : text.timeIn }}
            }
          </ion-button>
        </div>
      </section>

      <section class="workweek" [attr.aria-label]="text.workweek">
        <h2><ion-icon name="calendar-outline" aria-hidden="true" />{{ month }}</h2>
        <ul>
          @for (day of weekdays; track day.date) {
            <li>
              <time [attr.datetime]="day.date" [attr.aria-label]="day.label" [attr.aria-current]="day.today ? 'date' : null">
                <span>{{ day.weekday }}</span>
                <strong>{{ day.number }}</strong>
              </time>
            </li>
          }
        </ul>
      </section>

      <h2>{{ text.history }}</h2>
      <app-dtr-history [weeks]="weeks()" />
    </ion-content>
  `,
  styles: `
    ion-content.ion-padding { --background: var(--lb-page); }
    @media (max-width: 599px) {
      ion-content.ion-padding {
        --padding-start: 12px;
        --padding-end: 12px;
      }
    }
    .punch {
      display: grid;
      grid-template-columns: minmax(64px, 1fr) minmax(0, 2fr);
      align-items: center;
      gap: 14px;
      min-height: 138px;
      padding: 14px 20px;
      background: var(--lb-cream);
      border-radius: 14px;
    }
    .clock {
      position: relative;
      box-sizing: border-box;
      width: clamp(58px, 19vw, 84px);
      aspect-ratio: 1;
      margin: auto;
      border: 4px solid var(--ion-color-primary);
      border-radius: 50%;
    }
    .clock::before, .clock::after {
      content: '';
      position: absolute;
      border: 3px solid var(--ion-color-secondary);
    }
    .clock::before {
      inset: 13%;
      border-radius: 50%;
    }
    .clock::after {
      inset: 22% auto auto 50%;
      width: 22%;
      height: 30%;
      border-width: 0 0 3px 3px;
      border-radius: 2px;
      transform: skewY(20deg);
    }
    .punch-details {
      display: grid;
      text-align: center;
      color: var(--ion-color-primary);
    }
    .state, .hint {
      margin: 0;
      line-height: 1.35;
    }
    .state { font-weight: 700; }
    .hint {
      margin-top: 3px;
      font-size: 0.6875rem;
      color: var(--ion-color-medium-shade);
    }
    .open-time {
      order: -1;
      font: 800 1.5rem / 1.25 var(--font-heading);
      font-variant-numeric: tabular-nums;
    }
    ion-button {
      --border-radius: 8px;
      --padding-start: 8px;
      --padding-end: 8px;
      --ion-color-base: var(--ion-color-primary);
      --ion-color-shade: var(--ion-color-primary-shade);
      --ion-color-tint: var(--ion-color-primary-tint);
      --ion-color-contrast: var(--ion-color-primary-contrast);
      min-height: 44px;
      margin: 9px 0 0;
      font-size: 0.875rem;
    }
    ion-button::part(native) { background: var(--lb-primary-gradient); }
    .workweek {
      margin: 16px 8px 23px;
      padding: 8px 8px 13px;
      border: 1px solid var(--lb-panel-border);
      border-radius: 11px;
      background: var(--lb-panel);
    }
    .workweek h2 {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-bottom: 8px;
      font-size: 1rem;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 1.1rem;
      color: var(--ion-color-primary);
    }
    .workweek ul {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 42px));
      justify-content: center;
      gap: 10px;
      padding: 0;
      margin: 0;
      list-style: none;
    }
    .workweek time {
      display: grid;
      min-height: 56px;
      align-content: center;
      gap: 3px;
      padding: 5px 2px;
      border-radius: 11px;
      background: var(--ion-color-light);
      color: var(--ion-color-dark);
      text-align: center;
      font-size: 0.6875rem;
    }
    .workweek [aria-current='date'] {
      color: var(--ion-color-primary-contrast);
      background: var(--lb-primary-gradient);
    }
    .workweek strong { font: 700 1rem / 1.3 var(--font-heading); }
  `,
})
export class DtrPage {
  protected readonly strings = STRINGS;
  protected readonly text = STRINGS.dtr;
  protected readonly weeks = signal<HistoryWeek[]>([]);
  /** The time-in time of the open session ("08:05"), or null. */
  protected readonly openSince = signal<string | null>(null);
  protected readonly busy = signal(false);

  private readonly today = new Date();
  protected readonly month = monthFormat.format(this.today);
  protected readonly weekdays = workweek(this.today);

  private readonly dtr = inject(DtrService);
  private readonly auth = inject(AuthService);
  private readonly sync = inject(SyncService);
  private readonly toasts = inject(ToastController);

  constructor() {
    // Ask for the location permission now, so that a punch does not wait for the prompt (D-48).
    void inject(GEOLOCATION).prepare();
    // Read the local data again after each sync and each local change.
    effect(() => {
      this.sync.revision();
      untracked(() => void this.load());
    });
  }

  async punch(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      const result = this.openSince() ? await this.dtr.timeOut() : await this.dtr.timeIn();
      if (result.ok) {
        const saved = this.text.saved[result.punch.type];
        await this.toast(result.noLocation ? `${saved} ${this.text.noLocation}` : saved, 'success');
      } else {
        await this.toast(this.text.failure[result.reason], 'danger');
      }
      await this.load();
    } finally {
      this.busy.set(false);
    }
  }

  async refresh(event: CustomEvent): Promise<void> {
    try {
      await this.sync.trigger();
      await this.load();
    } finally {
      (event.target as HTMLIonRefresherElement).complete();
    }
  }

  private async load(): Promise<void> {
    const id = this.auth.profile()?.id;
    if (!id) {
      return;
    }
    const [weeks, open] = await Promise.all([this.dtr.history(id), this.dtr.currentOpenSession(id)]);
    this.weeks.set(weeks);
    this.openSince.set(open ? timeOfDay(String(open.timeIn.time)) : null);
  }

  private async toast(message: string, color: 'success' | 'danger'): Promise<void> {
    const t = await this.toasts.create({ message, color, duration: 2500, position: 'top' });
    await t.present();
  }
}
