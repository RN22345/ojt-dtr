// OJT DTR page (FR-DTR-01, FR-DTR-02, FR-DTR-06, FR-DTR-07, FR-SYNC-03). The time-in is one tap on this tab
// (QR-FS-03). The punch is saved offline first (system modules 5.1). Pull down to sync (FR-SYNC-03).
import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import {
  IonBadge,
  IonButton,
  IonContent,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  ToastController,
} from '@ionic/angular';
import { AuthService } from '../../core/auth/auth.service';
import { Punch } from '../../data/repositories/punch.repository';
import { SyncService } from '../../data/sync/sync.service';
import { GEOLOCATION } from '../../plugins/geolocation.plugin';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { STRINGS } from '../../shared/strings';
import { dateLabel, duration, timeOfDay } from '../../shared/utils/format';
import { HistoryWeek } from './dtr-history';
import { DtrService } from './dtr.service';

const STATUS_COLOR = { pending: 'warning', synced: 'success', issue: 'danger' } as const;

@Component({
  selector: 'app-dtr-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonButton,
    IonSpinner,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonNote,
    IonBadge,
  ],
  template: `
    <app-page-header [title]="strings.pages.ojtDtr" />
    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <section class="punch" aria-live="polite">
        <p class="state">{{ openSince() ? text.openSince(openSince()!) : text.noOpenSession }}</p>
        <ion-button expand="block" size="large" [color]="openSince() ? 'medium' : 'primary'" [disabled]="busy()" (click)="punch()">
          @if (busy()) {
            <ion-spinner name="dots" />
          } @else {
            {{ openSince() ? text.timeOut : text.timeIn }}
          }
        </ion-button>
      </section>

      <h2>{{ text.history }}</h2>
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
                    @if (s.timeIn.doubtfulTime || s.timeOut?.doubtfulTime) {
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
    </ion-content>
  `,
  styles: `
    .punch {
      margin-bottom: 24px;
    }
    .state {
      text-align: center;
      color: var(--ion-color-medium-shade);
    }
    .day {
      font-weight: 600;
      --background: var(--ion-color-light);
    }
    .flags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }
  `,
})
export class DtrPage {
  protected readonly strings = STRINGS;
  protected readonly text = STRINGS.dtr;
  protected readonly weeks = signal<HistoryWeek[]>([]);
  /** The time-in time of the open session ("08:05"), or null. */
  protected readonly openSince = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly date = dateLabel;
  protected readonly duration = duration;

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

  protected time(p: Punch): string {
    return timeOfDay(p.deviceTime);
  }

  protected statusColor(p: Punch): string {
    return STATUS_COLOR[p.syncStatus];
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
