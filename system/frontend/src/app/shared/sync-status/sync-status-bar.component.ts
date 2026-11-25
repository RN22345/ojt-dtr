// FR-SYNC-04 and FR-SYNC-08: the network status and the number of unsynced changes, on each mobile page.
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
      <div class="bar" [class]="sync.connection()" role="status" aria-live="polite">
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
        @if (sync.staleUnsynced()) {
          <span class="stale" role="alert">
            <ion-icon aria-hidden="true" name="warning-outline" />
            {{ text.stale }}
          </span>
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
      gap: var(--space-1) 10px;
      align-items: center;
      min-height: 33px;
      margin: 6px var(--space-2) 0;
      padding: 4px 8px;
      border-radius: 8px;
      background: var(--lb-online);
      color: var(--ion-color-dark);
      font-size: 0.6875rem;
      line-height: 1.45;
    }
    .state,
    .count,
    .issues {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
    }
    .state {
      font-weight: 700;
    }
    .state ion-icon {
      color: var(--ion-color-success-shade);
    }
    .count {
      font-weight: 600;
    }
    .bar.offline {
      background: rgba(var(--ion-color-medium-rgb), 0.12);
      color: var(--ion-color-medium-shade);
    }
    .bar.offline .state ion-icon {
      color: inherit;
    }
    .bar.unreachable {
      background: var(--lb-cream);
    }
    .bar.unreachable .state ion-icon {
      color: var(--ion-color-warning-shade);
    }
    ion-icon {
      flex-shrink: 0;
      font-size: 15px;
    }
    ion-spinner {
      width: 15px;
      height: 15px;
    }
    .issues {
      margin-left: auto;
      color: var(--ion-color-danger);
      font-weight: 700;
      text-decoration: none;
    }
    .issues:focus-visible {
      border-radius: 2px;
      outline: 2px solid var(--ion-color-primary);
      outline-offset: 3px;
    }
    /* QR-SF-04: the warning line of the old unsynced changes. */
    .stale {
      display: inline-flex;
      align-items: center;
      flex-basis: 100%;
      gap: var(--space-1);
      /* QR-IC-06: the warning shade on this bar is below 4.5:1, so the text uses the dark color. */
      color: var(--ion-color-dark);
      font-weight: 700;
    }
  `,
})
export class SyncStatusBarComponent {
  protected readonly sync = inject(SyncService);
  protected readonly mobile = inject(PlatformService).platform === 'mobile';
  protected readonly text = STRINGS.sync;
  protected readonly icon = computed(() => ICONS[this.sync.connection()]);
}
