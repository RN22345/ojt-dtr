// "Sync issues" screen (FR-SYNC-06, TC-ST-OJT-03): each change that the server did not accept, the cause,
// and the user actions "Try again" and "Discard my change" (offline sync design, section 3).
import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { AlertController, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonContent } from '@ionic/angular';
import { AuthService } from '../../core/auth/auth.service';
import { SyncIssue, SyncIssueRepository } from '../../data/repositories/sync-issue.repository';
import { SyncService } from '../../data/sync/sync.service';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { STRINGS } from '../../shared/strings';
import { issueCause, issueTime, issueTitle } from './sync-issue-text';

@Component({
  selector: 'app-sync-issues-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonButton],
  template: `
    <app-page-header [title]="strings.pages.syncIssues" [backHref]="home()" />
    <ion-content class="ion-padding">
      @if (issues().length === 0) {
        <p class="empty">{{ text.none }}</p>
      } @else {
        <p>{{ text.intro }}</p>
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
              <ion-button size="small" [disabled]="busy()" (click)="retry(issue)">{{ text.retry }}</ion-button>
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
    p {
      margin: var(--space-2) 0 var(--space-5);
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--ion-color-dark);
    }
    /* No issue: a check mark on a document, drawn with CSS */
    p.empty {
      position: relative;
      max-width: 340px;
      margin: 100px auto var(--space-5);
      padding-top: 148px;
      text-align: center;
      font-family: var(--font-heading);
      font-size: 1rem;
      font-weight: 700;
      color: var(--ion-color-primary);
    }
    p.empty::before {
      content: '';
      position: absolute;
      top: 0;
      left: calc(50% - 46px);
      width: 92px;
      height: 120px;
      border: 4px solid var(--ion-color-primary);
      border-radius: 10px;
      background: radial-gradient(circle at 50% 56%, var(--ion-color-success) 0 27px, transparent 28px), var(--lb-mist);
      box-shadow: inset 0 0 0 8px var(--ion-background-color);
    }
    p.empty::after {
      content: '';
      position: absolute;
      top: 49px;
      left: calc(50% - 8px);
      width: 15px;
      height: 27px;
      border: solid var(--ion-color-success-contrast);
      border-width: 0 4px 4px 0;
      transform: rotate(45deg);
    }
    ion-card {
      margin: 0 0 var(--space-4);
      border-color: rgba(var(--ion-color-primary-rgb), 0.16);
      border-radius: 10px;
    }
    ion-card-header {
      gap: 6px;
      padding: var(--space-4) 14px 10px;
    }
    ion-card-subtitle {
      font-size: 0.75rem;
      font-weight: 500;
      line-height: 1.5;
      letter-spacing: 0;
      color: var(--ion-color-medium-shade);
    }
    ion-card-content {
      padding: 0 14px var(--space-4);
      line-height: 1.6;
    }
    ion-card-content p {
      margin: 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-top: 20px;
    }
    .actions ion-button {
      flex: 1 1 auto;
      margin: 0;
      --border-radius: 7px;
      --padding-start: var(--space-3);
      --padding-end: var(--space-3);
      font-size: 0.75rem;
    }
    /* "Try again" is the main action: primary fill */
    .actions ion-button:not([color]) {
      --background: var(--ion-color-primary);
      --background-hover: var(--ion-color-primary-tint);
      --background-activated: var(--ion-color-primary-shade);
      --color: var(--ion-color-primary-contrast);
    }
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
