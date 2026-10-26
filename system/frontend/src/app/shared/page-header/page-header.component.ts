// The header of each page: the title, the logout button, and the sync status bar (FR-SYNC-04).
// The logout shows the CAUTION with the count of unsynced changes (FR-AUTH-05, QR-SF-01, TC-ST-OJT-04).
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { LogoutService } from '../../core/auth/logout.service';
import { SyncStatusBarComponent } from '../sync-status/sync-status-bar.component';
import { STRINGS } from '../strings';

@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonBackButton, SyncStatusBarComponent],
  template: `
    <ion-header>
      <ion-toolbar>
        @if (backHref()) {
          <ion-buttons slot="start">
            <ion-back-button [defaultHref]="backHref()" />
          </ion-buttons>
        }
        <ion-title>{{ title() }}</ion-title>
        <ion-buttons slot="end">
          <ion-button [disabled]="busy()" (click)="logout()">{{ strings.logout }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
      <app-sync-status-bar />
    </ion-header>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  /** If given, the header shows a back button to this URL. */
  readonly backHref = input<string | null>(null);

  protected readonly strings = STRINGS;
  protected readonly busy = signal(false);
  private readonly logouts = inject(LogoutService);
  private readonly alerts = inject(AlertController);
  private readonly router = inject(Router);

  async logout(): Promise<void> {
    this.busy.set(true);
    try {
      const unsynced = await this.logouts.unsyncedBeforeLogout();
      if (unsynced > 0 && !(await this.confirmLoss(unsynced))) {
        return;
      }
      if (await this.logouts.logout(unsynced > 0)) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
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
