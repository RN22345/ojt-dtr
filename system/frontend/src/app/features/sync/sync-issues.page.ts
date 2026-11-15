// "Sync issues" screen (FR-SYNC-06, TC-ST-OJT-03): each change that the server did not accept, the cause,
// and the user actions "Try again" and "Discard my change" (offline sync design, section 3).
import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { AlertController, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth/auth.service';
import { SyncIssue, SyncIssueRepository } from '../../data/repositories/sync-issue.repository';
import { SyncService } from '../../data/sync/sync.service';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { STRINGS } from '../../shared/strings';
import { issueCause, issueTime, issueTitle } from './sync-issue-text';

addIcons({ checkmarkOutline });

@Component({
  selector: 'app-sync-issues-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonButton, IonIcon],
  template: `
    <app-page-header [title]="strings.pages.syncIssues" [backHref]="home()" [compact]="true" />
    <ion-content class="ion-padding">
      @if (issues().length === 0) {
        <section class="clear-state" aria-labelledby="sync-clear-title">
          <div class="clipboard" aria-hidden="true">
            <span class="clip"></span>
            <span class="check"><ion-icon name="checkmark-outline" /></span>
          </div>
          <h2 id="sync-clear-title">{{ text.none }}</h2>
          <p>{{ text.allAccepted }}</p>
        </section>
      } @else {
        <p class="intro">{{ text.intro }}</p>
      }
      @for (issue of issues(); track issue.opId) {
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ title(issue) }}</ion-card-title>
            <ion-card-subtitle>{{ text.madeAt(madeAt(issue)) }}</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <p>{{ cause(issue) }}</p>
            <div class="actions">
              <ion-button class="retry" [disabled]="busy()" (click)="retry(issue)">{{ text.retry }}</ion-button>
              <ion-button size="small" fill="outline" color="danger" [disabled]="busy()" (click)="discard(issue)">
                {{ text.discard }}
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>
      }
    </ion-content>
  `,
  styles: `
    ion-content {
      --background: var(--lb-page);
      --padding-start: 14px;
      --padding-end: 14px;
    }
    .intro { max-width: 34ch; margin: 4px 6px 28px; font-size: 0.8125rem; }
    .clear-state { margin: clamp(72px, 17vh, 146px) auto 24px; text-align: center; }
    .clear-state h2 { margin: 10px 0 4px; font-size: 1.35rem; color: var(--ion-color-primary); }
    .clear-state p { margin: 0; color: var(--ion-color-medium-shade); font-size: 0.8125rem; }
    .clipboard {
      position: relative;
      display: grid;
      place-items: center;
      width: 128px;
      height: 139px;
      margin-inline: auto;
      border: 7px solid var(--ion-color-primary);
      border-radius: 17px;
      background: color-mix(in srgb, var(--lb-mist), var(--lb-panel) 48%);
      box-shadow: inset 0 0 0 10px var(--lb-page);
    }
    .clip {
      position: absolute;
      top: -25px;
      width: 61px;
      height: 38px;
      border-radius: 21px 21px 2px 2px;
      background: radial-gradient(circle at 50% 33%, var(--lb-page) 0 6px, transparent 7px), var(--ion-color-primary);
      box-shadow: 0 0 0 5px var(--lb-page);
    }
    .clipboard::before,
    .clipboard::after {
      content: '+';
      position: absolute;
      color: var(--ion-color-secondary);
      font-size: 20px;
      font-weight: 700;
    }
    .clipboard::before { left: -23px; top: 23px; }
    .clipboard::after { right: -22px; top: 65px; }
    .check {
      display: grid;
      place-items: center;
      width: 66px;
      height: 66px;
      border-radius: 50%;
      background: var(--lb-sync-check);
      color: var(--lb-panel);
      font-size: 48px;
    }
    ion-card {
      margin: 0 0 16px;
      background: var(--lb-panel);
      border-color: var(--lb-panel-border);
    }
    ion-card-header {
      padding: 16px 14px 10px;
    }
    ion-card-title { font-size: 1.25rem; margin-bottom: 5px; }
    ion-card-subtitle {
      font-size: 0.6875rem;
      font-weight: 700;
      line-height: 1.5;
      letter-spacing: 0;
      text-transform: uppercase;
      color: var(--ion-color-medium-shade);
    }
    ion-card-content {
      padding: 0 14px 16px;
      font-size: 0.8125rem;
      line-height: 1.6;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 30px;
    }
    .actions ion-button {
      flex: 1 1 auto;
      margin: 0;
      min-height: 40px;
      --border-radius: 11px;
      --padding-start: 12px;
      --padding-end: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .retry::part(native) { background: var(--lb-primary-gradient); }
    .actions ion-button[color='danger']::part(native) { background: var(--lb-danger-soft); }
  `,
})
export class SyncIssuesPage {
  protected readonly strings = STRINGS;
  protected readonly text = STRINGS.issues;
  protected readonly issues = signal<SyncIssue[]>([]);
  protected readonly busy = signal(false);

  private readonly repo = inject(SyncIssueRepository);
  private readonly auth = inject(AuthService);
  private readonly sync = inject(SyncService);
  private readonly alerts = inject(AlertController);

  constructor() {
    effect(() => {
      this.sync.revision();
      untracked(() => void this.load());
    });
  }

  protected home(): string {
    return this.auth.profile()?.role === 'facilitator' ? '/facilitator' : '/ojt/dtr';
  }

  protected readonly title = issueTitle;
  protected readonly madeAt = issueTime;
  protected readonly cause = issueCause;

  async retry(issue: SyncIssue): Promise<void> {
    await this.act(() => this.repo.retry(issue));
  }

  async discard(issue: SyncIssue): Promise<void> {
    const alert = await this.alerts.create({
      message: this.text.discardConfirm,
      buttons: [
        { text: this.text.cancel, role: 'cancel' },
        { text: this.text.discard, role: 'destructive' },
      ],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role === 'destructive') {
      await this.act(() => this.repo.discard(issue));
    }
  }

  private async act(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
      this.sync.changed();
      await this.load();
    } finally {
      this.busy.set(false);
    }
  }

  private async load(): Promise<void> {
    const id = this.auth.profile()?.id;
    this.issues.set(id ? await this.repo.list(id) : []);
  }
}
