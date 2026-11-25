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
      --background: var(--lb-page);
    }
    app-admin-page > ion-content::part(scroll) { max-width: none; }
    .adm-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: var(--space-5) clamp(14px, 2vw, 24px);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
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
      min-width: min(160px, 100%);
      --background: var(--lb-panel);
    }
    .adm-bar > ion-button:only-child { margin-inline-start: auto; }
    .adm-page ion-button {
      min-height: 36px;
      font-size: 0.8125rem;
    }
    .adm-page ion-button:not([color]):not(.button-outline):not(.button-clear) {
      --background: var(--lb-primary-gradient);
      --background-hover: var(--ion-color-primary-tint);
      --background-activated: var(--ion-color-primary-shade);
      --color: var(--ion-color-primary-contrast);
    }
    .adm-tiles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(160px, 100%), 1fr));
      gap: var(--space-3);
    }
    .adm-tiles > app-stat-tile { --ion-color-light: var(--lb-panel); }
    .adm-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .adm-form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
      gap: var(--space-4);
      padding: var(--space-4);
      border: 1px solid var(--lb-panel-border);
      border-radius: var(--radius-s);
      background: var(--lb-panel);
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
      border: 1px solid var(--lb-panel-border);
      border-radius: 7px;
      background: var(--lb-panel);
    }
    /* QR-IC-07: the table scroll region takes the focus, so a keyboard user can scroll it. */
    .adm-scroll:focus-visible {
      outline: 2px solid var(--ion-color-primary);
      outline-offset: 2px;
    }
    .adm-table {
      width: 100%;
      min-width: 540px;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }
    .adm-table th,
    .adm-table td {
      padding: 9px 13px;
      text-align: start;
      vertical-align: middle;
    }
    .adm-table th {
      border-bottom: 1px solid var(--lb-panel-border);
      background: var(--lb-admin-muted, var(--ion-color-light));
      font-weight: 650;
      color: var(--ion-color-medium-shade);
      white-space: nowrap;
    }
    .adm-table tbody tr + tr { border-top: 1px solid var(--lb-panel-border); }
    .adm-table ion-button {
      margin: 0;
      --padding-start: var(--space-3);
      --padding-end: var(--space-3);
      min-height: 32px;
    }
    .adm-table ion-button:focus-visible { outline-offset: -2px; }
    .adm-table ion-badge {
      padding: 3px 7px;
      border-radius: 4px;
      font-size: 0.6875rem;
      font-weight: 650;
    }
    /* QR-IC-06: the Ionic .ion-color-* classes set these values with !important, so these rules need it too.
       Dark text on the success color gives 4.6:1. White text gave 3.45:1. */
    .adm-table ion-badge[color='success'] {
      --ion-color-base: var(--lb-admin-success, var(--ion-color-success)) !important;
      --ion-color-contrast: var(--ion-color-dark) !important;
    }
    .adm-table ion-badge[color='medium'] {
      --ion-color-base: var(--ion-color-light) !important;
      --ion-color-contrast: var(--ion-color-dark) !important;
    }
    .adm-table .adm-num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .adm-sub {
      margin: 0;
      font-size: 1rem;
      color: var(--ion-color-primary);
    }
    .adm-muted {
      color: var(--ion-color-medium-shade);
      font-size: 0.85rem;
    }
    @media (max-width: 520px) {
      .adm-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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
