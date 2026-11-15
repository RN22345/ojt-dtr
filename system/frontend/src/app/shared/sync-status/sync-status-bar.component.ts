// (sync-status-bar.component.ts) FR-SYNC-04 and FR-SYNC-08: the network status and the number of unsynced changes, on each mobile page.
// "Server not reachable" is different from "No network". The issue count opens the "Sync issues" screen.
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircleOutline, cloudDoneOutline, cloudOfflineOutline, warningOutline } from 'ionicons/icons';
import { PlatformService } from '../../core/platform.service';
import { SyncService } from '../../data/sync/sync.service';
import { STRINGS } from '../strings';

addIcons({ alertCircleOutline, cloudDoneOutline, cloudOfflineOutline, warningOutline });

const ICONS = { online: 'cloud-done-outline', offline: 'cloud-offline-outline', unreachable: 'warning-outline' } as const;

@Component({
  selector: 'app-sync-status-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, IonSpinner, RouterLink],
  template: `
    @if (mobile) {
      <div class="bar" [class]="sync.connection()" [class.attention]="sync.unsynced() > 0 || sync.issues() > 0" role="status" aria-live="polite">
        <span class="state">
          <ion-icon aria-hidden="true" [name]="icon()" />
          {{ text[sync.connection()] }}
        </span>
        <span class="count">
          @if (sync.syncing()) {
            <ion-spinner name="dots" aria-hidden="true" />
            {{ text.syncing }}
          } @else if (sync.unsynced() === 0) {
            {{ text.allSynced }}
          } @else {
            {{ text.unsynced(sync.unsynced()) }}
          }
        </span>
        @if (sync.issues() > 0) {
          <a class="issues" routerLink="/sync-issues">
            <ion-icon aria-hidden="true" name="alert-circle-outline" />
            {{ text.issues(sync.issues()) }}
          </a>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      background: var(--lb-screen-surface, var(--ion-background-color));
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 10px;
      min-height: var(--lb-sync-height, 0);
      margin: 6px 10px 0;
      padding: 6px 7px;
      border-radius: 8px;
      background: var(--lb-online);
      color: var(--ion-color-dark);
      font-size: var(--lb-sync-font-size, 0.625rem);
      line-height: 1.45;
    }
    .state,
    .count,
    .issues {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .state {
      font-weight: 700;
    }
    .state ion-icon { color: var(--ion-color-success-shade); }
    .online.attention :is(.state, .count, .issues) { color: var(--lb-sync-attention); }
    .count {
      font-weight: 600;
    }
    .bar.offline {
      background: rgba(var(--ion-color-medium-rgb), 0.12);
      color: var(--ion-color-medium-shade);
    }
    .bar.offline :is(.state, ion-icon) {
      color: var(--ion-color-medium-shade);
    }
    .bar.unreachable {
      background: var(--lb-cream);
      color: var(--ion-color-dark);
    }
    .bar.unreachable :is(.state, ion-icon) {
      color: var(--ion-color-warning-shade);
    }
    ion-icon {
      flex-shrink: 0;
      font-size: 17px;
    }
    ion-spinner {
      width: 15px;
      height: 15px;
    }
    .issues {
      color: var(--ion-color-danger);
      font-weight: 700;
      text-decoration: none;
    }
    .issues:focus-visible {
      outline: 2px solid var(--ion-color-primary);
      outline-offset: 3px;
      border-radius: 2px;
    }
  `,
})
export class SyncStatusBarComponent {
  protected readonly sync = inject(SyncService);
  protected readonly mobile = inject(PlatformService).platform === 'mobile';
  protected readonly text = STRINGS.sync;
  protected readonly icon = computed(() => ICONS[this.sync.connection()]);
}
