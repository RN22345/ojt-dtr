// QR-IC-08: the sync status of one record, with an icon and a text label.
// A draft that is not saved has the status 'none'. Then the badge is empty.
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cloudDoneOutline, cloudOfflineOutline, warningOutline } from 'ionicons/icons';
import { SyncStatus } from '../../data/repositories/punch.repository';
import { STRINGS } from '../strings';

addIcons({ cloudDoneOutline, cloudOfflineOutline, warningOutline });

const ICONS = { pending: 'cloud-offline-outline', synced: 'cloud-done-outline', issue: 'warning-outline' } as const;

@Component({
  selector: 'app-sync-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  template: `
    @if (label()) {
      <span class="badge" [class.pending]="status() === 'pending'" [class.synced]="status() === 'synced'" [class.issue]="status() === 'issue'">
        <ion-icon aria-hidden="true" [name]="icon()" />
        {{ label() }}
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 3px 7px;
      border-radius: 5px;
      font-size: 0.625rem;
      font-weight: 600;
      line-height: 1.25;
      white-space: nowrap;
    }
    ion-icon {
      flex-shrink: 0;
      font-size: 12px;
    }
    .badge.pending {
      background: rgba(var(--ion-color-warning-rgb), 0.16);
      color: var(--ion-color-warning-shade);
    }
    .badge.synced {
      background: var(--lb-online);
      color: var(--ion-color-success-shade);
    }
    .badge.issue {
      background: rgba(var(--ion-color-danger-rgb), 0.12);
      color: var(--ion-color-danger-shade);
    }
  `,
})
export class SyncBadgeComponent {
  /** The sync status of the record, or 'none' for a draft that is not saved. */
  readonly status = input.required<SyncStatus | 'none'>();

  protected readonly label = computed(() => {
    const status = this.status();
    return status === 'none' ? '' : STRINGS.dtr.status[status];
  });

  protected readonly icon = computed(() => {
    const status = this.status();
    return status === 'none' ? '' : ICONS[status];
  });
}
