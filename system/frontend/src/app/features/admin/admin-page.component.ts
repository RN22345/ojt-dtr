// The frame of each admin page: header, offline message (TC-ST-ADM-02), error and notice lines, and shared styles.
// The styles use the prefix `adm-` and have no encapsulation, so the pages can use them in projected content.
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject, input } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { ADM_STRINGS } from '../../shared/strings-adm';
import { AdminOnline } from './admin-online.service';

@Component({
  selector: 'app-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [IonContent, PageHeaderComponent],
  template: `
    <app-page-header [title]="title()" />
    <ion-content>
      <div class="adm-page">
        @if (!network.online()) {
          <p class="adm-offline" role="alert" data-testid="offline">{{ text.offline }}</p>
        }
        @if (error()) {
          <p class="adm-error" role="alert" data-testid="error">{{ error() }}</p>
        }
        @if (notice()) {
          <p class="adm-notice" role="status" data-testid="notice">{{ notice() }}</p>
        }
        <ng-content />
      </div>
    </ion-content>
  `,
  styles: `
    /* The frame is between the Ionic page and ion-content. It must fill the page, or ion-content has no height. */
    app-admin-page {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
    }
    app-admin-page > ion-content {
      flex: 1 1 auto;
    }
    .adm-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .adm-offline,
    .adm-error,
    .adm-notice {
      margin: 0;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-s);
      border-left: 4px solid;
    }
    .adm-offline {
      border-color: var(--ion-color-warning);
      background: var(--ion-color-warning-tint);
      color: var(--ion-color-warning-contrast);
    }
    .adm-error {
      border-color: var(--ion-color-danger);
      background: var(--ion-color-light);
      color: var(--ion-color-danger-shade);
    }
    .adm-notice {
      border-color: var(--ion-color-success);
      background: var(--ion-color-light);
    }
    .adm-bar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      align-items: center;
    }
    .adm-bar > ion-input,
    .adm-bar > ion-select {
      flex: 1 1 200px;
      min-width: 160px;
    }
    .adm-tiles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: var(--space-3);
    }
    .adm-form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: var(--space-4);
      padding: var(--space-4);
      border-radius: var(--radius-m);
      background: var(--ion-color-light);
    }
    .adm-form h2,
    .adm-form .adm-wide {
      grid-column: 1 / -1;
    }
    .adm-form h2 {
      margin: 0;
      font-size: 1.1rem;
    }
    .adm-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .adm-scroll {
      overflow-x: auto;
    }
    .adm-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .adm-table th,
    .adm-table td {
      padding: var(--space-2) var(--space-3);
      text-align: left;
      border-bottom: 1px solid var(--ion-color-light-shade);
      vertical-align: middle;
    }
    .adm-table th {
      font-weight: 600;
      color: var(--ion-color-medium-shade);
      white-space: nowrap;
    }
    .adm-table .adm-num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .adm-sub {
      margin: 0;
      font-size: 1rem;
    }
    .adm-muted {
      color: var(--ion-color-medium-shade);
      font-size: 0.85rem;
    }
  `,
})
export class AdminPageComponent {
  readonly title = input.required<string>();
  readonly error = input('');
  readonly notice = input('');
  protected readonly network = inject(AdminOnline);
  protected readonly text = ADM_STRINGS;
}
