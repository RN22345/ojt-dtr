// OJT DTR page (FR-DTR-01, FR-DTR-02, FR-DTR-06, FR-DTR-07, FR-SYNC-03). The time-in is one tap on this tab
// (QR-FS-03). The punch is saved offline first (system modules 5.1). Pull down to sync (FR-SYNC-03).
import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { IonButton, IonContent, IonRefresher, IonRefresherContent, IonSpinner, ToastController } from '@ionic/angular';
import { AuthService } from '../../core/auth/auth.service';
import { SyncService } from '../../data/sync/sync.service';
import { GEOLOCATION } from '../../plugins/geolocation.plugin';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { STRINGS } from '../../shared/strings';
import { timeOfDay } from '../../shared/utils/format';
import { HistoryWeek } from './dtr-history';
import { DtrHistoryComponent } from './dtr-history.component';
import { DtrService } from './dtr.service';

@Component({
  selector: 'app-dtr-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IonContent, IonRefresher, IonRefresherContent, IonButton, IonSpinner, DtrHistoryComponent],
  template: `
    <app-page-header [title]="strings.pages.ojtDtr" />
    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <section class="punch" aria-live="polite">
        <p class="state">{{ openSince() ? text.openSince(openSince()!) : text.noOpenSession }}</p>
        <ion-button expand="block" size="large" [color]="openSince() ? 'primary' : 'secondary'" [disabled]="busy()" (click)="punch()">
          @if (busy()) {
            <ion-spinner name="dots" />
          } @else {
            {{ openSince() ? text.timeOut : text.timeIn }}
          }
        </ion-button>
      </section>

      <h2>{{ text.history }}</h2>
      <app-dtr-history [weeks]="weeks()" />
    </ion-content>
  `,
  styles: `
    .punch {
      position: relative;
      margin-bottom: 22px;
      padding: var(--space-5) 14px var(--space-3);
      border-radius: 14px;
      background: var(--lb-cream);
    }
    /* A clock mark above the status text */
    .punch::before {
      content: '';
      display: block;
      box-sizing: border-box;
      width: 62px;
      height: 62px;
      margin: 0 auto 18px;
      border: 3px solid var(--lb-sky);
      border-radius: 50%;
      outline: 2px solid var(--ion-color-primary);
      outline-offset: 4px;
      pointer-events: none;
    }
    .punch::after {
      content: '';
      position: absolute;
      top: 39px;
      left: 50%;
      width: 15px;
      height: 18px;
      border-bottom: 2px solid var(--ion-color-primary);
      border-left: 2px solid var(--ion-color-primary);
      transform: skewY(25deg);
      pointer-events: none;
    }
    .state {
      margin: 0 0 var(--space-4);
      text-align: center;
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1.6;
      color: var(--ion-color-primary);
      font-variant-numeric: tabular-nums;
    }
    ion-button {
      margin: 0;
      font-size: 0.95rem;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 1.1rem;
      color: var(--ion-color-primary);
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
