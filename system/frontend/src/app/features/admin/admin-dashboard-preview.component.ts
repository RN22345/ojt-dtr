import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ADMIN_DASHBOARD_PREVIEW } from './admin-dashboard-preview.strings';
import { AdminPreviewTableComponent } from './admin-preview-table.component';

@Component({
  selector: 'app-admin-dashboard-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminPreviewTableComponent],
  template: `
    <dl class="totals" [attr.aria-label]="text.statsLabel">
      @for (stat of text.stats; track stat.label) {
        <div class="total">
          <dt>{{ stat.label }}</dt>
          <dd [attr.data-tone]="stat.tone">{{ stat.value }}</dd>
        </div>
      }
    </dl>

    <section class="keep-alive" aria-labelledby="keep-alive-title">
      <h2 id="keep-alive-title">{{ text.keepAliveTitle }}</h2>
      <ul>
        @for (source of text.keepAlive; track source.label) {
          <li [attr.data-tone]="source.tone">{{ source.label }}</li>
        }
      </ul>
    </section>

    <section aria-labelledby="recent-audit-title">
      <h2 id="recent-audit-title">{{ text.auditTitle }}</h2>
      <app-admin-preview-table [table]="text.audit" [label]="text.auditTitle" />
    </section>
  `,
  styles: `
    :host { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
    .totals {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin: 0;
    }
    .total, .keep-alive {
      background: var(--lb-panel);
      border-radius: 8px;
      padding: 12px 14px;
    }
    .total { display: flex; flex-direction: column; gap: 3px; }
    .total dt {
      order: 1;
      font-size: 0.75rem;
      color: var(--ion-color-medium-shade);
    }
    .total dd {
      margin: 0;
      font: 800 1.35rem / 1.2 var(--font-heading);
      font-variant-numeric: tabular-nums;
    }
    .total dd[data-tone='primary'] { color: var(--ion-color-primary); }
    .total dd[data-tone='warning'] { color: var(--ion-color-warning-shade); }
    h2 { margin: 0 0 10px; font-size: 1rem; }
    .keep-alive h2 { margin-bottom: 6px; font-size: 0.875rem; }
    .keep-alive ul {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .keep-alive li {
      padding: 3px 7px;
      border-radius: 4px;
      color: var(--ion-color-dark);
      font-size: 0.6875rem;
      font-weight: 700;
    }
    .keep-alive li[data-tone='success'] { background: var(--lb-admin-success, var(--ion-color-success-tint)); }
    .keep-alive li[data-tone='warning'] { background: var(--ion-color-warning); }
    @media (max-width: 640px) {
      .totals { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `,
})
export class AdminDashboardPreviewComponent {
  protected readonly text = ADMIN_DASHBOARD_PREVIEW;
}
