// Page title and sync status (FR-SYNC-04). Admin keeps its web logout here; mobile logout is in Profile.
// The logout shows the CAUTION with the count of unsynced changes (FR-AUTH-05, QR-SF-01, TC-ST-OJT-04).
// On mobile, the header also opens the notifications (FR-NOTI-05) and the profile (FR-PROF-01).
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonBadge,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  LoadingController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBackOutline, notificationsOutline, personCircleOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth/auth.service';
import { LogoutService } from '../../core/auth/logout.service';
import { MockStore } from '../../data/mock/mock-store.service';
import { UI_STRINGS } from '../strings-ui';
import { SyncStatusBarComponent } from '../sync-status/sync-status-bar.component';
import { STRINGS } from '../strings';

addIcons({ chevronBackOutline, notificationsOutline, personCircleOutline });

@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonBackButton, IonIcon, IonBadge, RouterLink, SyncStatusBarComponent],
  template: `
    <ion-header>
      <ion-toolbar [class.compact]="compact()">
        @if (backHref()) {
          <ion-buttons slot="start">
            <ion-back-button [defaultHref]="backHref()" [icon]="compact() ? 'chevron-back-outline' : undefined" [text]="compact() ? '' : undefined" />
          </ion-buttons>
        }
        <ion-title>{{ title() }}</ion-title>
        <ion-buttons slot="end">
          @if (mobileRole() && !compact()) {
            <ion-button routerLink="/notifications" [attr.aria-label]="ui.header.notifications">
              <ion-icon slot="icon-only" name="notifications-outline" />
              @if (mock.unreadCount() > 0) {
                <ion-badge color="danger" class="count">{{ mock.unreadCount() }}</ion-badge>
              }
            </ion-button>
            <ion-button routerLink="/profile" [attr.aria-label]="ui.header.profile">
              <ion-icon slot="icon-only" name="person-circle-outline" />
            </ion-button>
          }
          @if (!mobileRole()) {
            <ion-button [disabled]="busy()" (click)="logout()">{{ strings.logout }}</ion-button>
          }
        </ion-buttons>
      </ion-toolbar>
      <app-sync-status-bar />
    </ion-header>
  `,
  styles: `
    :host {
      display: block;
    }
    ion-header {
      box-shadow: none;
      background: var(--lb-screen-surface, var(--ion-background-color));
    }
    ion-toolbar {
      --min-height: calc(var(--lb-toolbar-height, 58px) - var(--lb-toolbar-top-space, 0px));
      --padding-top: var(--lb-toolbar-top-space, 0px);
      --padding-start: 8px;
      --padding-end: 8px;
      --border-width: 0;
    }
    ion-title {
      padding-inline: 8px;
      font-size: var(--lb-toolbar-title-size, 1rem);
      font-weight: 700;
    }
    ion-buttons {
      gap: 0;
      margin-inline-end: 0;
    }
    ion-button {
      position: relative;
      --padding-start: 7px;
      --padding-end: 7px;
      --color: var(--ion-color-primary-contrast);
      min-height: 44px;
      margin: 0;
      font-size: 0.75rem;
      font-weight: 400;
    }
    ion-icon {
      font-size: 21px;
    }
    ion-back-button {
      --color: var(--ion-color-primary-contrast);
      --icon-font-size: 22px;
      font-size: 0.75rem;
    }
    .count {
      position: absolute;
      top: 2px;
      right: 0;
      min-width: 15px;
      padding: 2px 4px;
      border: 2px solid var(--ion-color-primary);
      border-radius: 8px;
      font-size: 0.55rem;
      line-height: 1;
    }
    ion-toolbar.compact { --padding-start: 0; }
    .compact ion-buttons[slot='start'] { margin-inline-start: 0; }
    .compact ion-back-button {
      --icon-font-size: 17px;
      --min-width: 40px;
      --padding-start: 0;
      --padding-end: 0;
      min-width: 40px;
      width: 40px;
      margin: 0;
    }
    .compact ion-title { padding-inline-start: 0; }
    @media (max-width: 359px) {
      ion-title {
        padding-inline: 4px;
        font-size: 0.875rem;
      }
      ion-button {
        --padding-start: 5px;
        --padding-end: 5px;
      }
    }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  /** If given, the header shows a back button to this URL. */
  readonly backHref = input<string | null>(null);
  readonly compact = input(false);

  protected readonly strings = STRINGS;
  protected readonly ui = UI_STRINGS;
  readonly busy = signal(false);
  protected readonly mock = inject(MockStore);
  private readonly role = inject(AuthService).role;
  protected readonly mobileRole = computed(() => this.role() === 'ojt' || this.role() === 'facilitator');
  private readonly logouts = inject(LogoutService);
  private readonly alerts = inject(AlertController);
  private readonly loadings = inject(LoadingController);
  private readonly router = inject(Router);

  async logout(): Promise<void> {
    this.busy.set(true);
    try {
      const unsynced = await this.logouts.unsyncedBeforeLogout();
      if (unsynced > 0 && !(await this.confirmLoss(unsynced))) {
        return;
      }
      // The page must not take taps while the local data is removed (DEF-014).
      const blocker = await this.loadings.create({ message: this.strings.loggingOut });
      await blocker.present();
      try {
        if (await this.logouts.logout(unsynced > 0)) {
          await this.router.navigateByUrl('/login', { replaceUrl: true });
        }
      } finally {
        await blocker.dismiss();
      }
    } finally {
      this.busy.set(false);
    }
  }

  private async confirmLoss(count: number): Promise<boolean> {
    const c = STRINGS.logoutCaution;
    const alert = await this.alerts.create({
      header: c.header,
      message: c.message(count),
      buttons: [
        { text: c.cancel, role: 'cancel' },
        { text: c.confirm, role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'destructive';
  }
}
