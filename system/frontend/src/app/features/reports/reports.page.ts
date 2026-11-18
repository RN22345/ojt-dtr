// OJT weekly reports: one row for each week, with a filter by status (FR-RPT-01 to FR-RPT-06).
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonItem, IonLabel, IonList, IonSegment, IonSegmentButton } from '@ionic/angular';
import { addDays } from '../../data/store/store-models';
import { WorkStore } from '../../data/store/work-store.service';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { STRINGS } from '../../shared/strings';
import { OJT_STRINGS } from '../../shared/strings-ojt';
import { UI_STRINGS } from '../../shared/strings-ui';
import { StatTileComponent } from '../../shared/ui/stat-tile.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { dateLabel } from '../../shared/utils/format';

type Filter = 'all' | 'todo' | 'submitted' | 'approved';

interface Row {
  week: string;
  end: string;
  minutes: number;
  status: string;
  remark: string | null;
}

const shortDate = new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', month: 'short', day: 'numeric' });

/** The status groups of the filter. A week without a report belongs to "To do". */
function matches(filter: Filter, status: string): boolean {
  switch (filter) {
    case 'todo':
      return status === 'draft' || status === 'returned' || status === 'none';
    case 'submitted':
      return status === 'submitted';
    case 'approved':
      return status === 'approved';
    default:
      return true;
  }
}

@Component({
  selector: 'app-reports-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IonButton, NgTemplateOutlet, IonContent, IonSegment, IonSegmentButton, IonList, IonItem, IonLabel, RouterLink, StatusBadgeComponent, StatTileComponent],
  template: `
    <app-page-header [title]="strings.pages.ojtReports" />
    <ion-content class="ion-padding">
      @let shown = visible();
      <details>
        <summary>{{ text.filters }}</summary>
        <div class="tiles">
          <app-stat-tile [label]="text.filterTodo" [value]="counts().todo" color="medium" />
          <app-stat-tile [label]="text.filterSubmitted" [value]="counts().submitted" color="warning" />
          <app-stat-tile [label]="text.filterApproved" [value]="counts().approved" color="success" />
        </div>

        <ion-segment [value]="filter()" (ionChange)="setFilter($event)">
          <ion-segment-button value="all">
            <ion-label>{{ text.filterAll }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="todo">
            <ion-label>{{ text.filterTodo }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="submitted">
            <ion-label>{{ text.filterSubmitted }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="approved">
            <ion-label>{{ text.filterApproved }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </details>

      @if (shown.length === 0) {
        <p class="empty">{{ text.empty }}</p>
      }

      <ng-template #reportRows let-rows>
        <ion-list>
          @for (row of rows; track row.week) {
            <ion-item [routerLink]="['/ojt/reports', row.week]" detail>
              <ion-label class="ion-text-wrap" [attr.title]="dateLabel(row.week) + ' – ' + dateLabel(row.end)">
                <h2>{{ text.weekOf(shortDateLabel(row.week)) }}</h2>
                <p>{{ shortDateLabel(row.week) }} – {{ shortDateLabel(row.end) }}</p>
                <p>{{ text.weekHours(ui.hours(row.minutes)) }}</p>
                @if (row.remark) {
                  <p class="remark">{{ text.returnedRemark(row.remark) }}</p>
                }
              </ion-label>
              <app-status-badge slot="end" [status]="row.status" />
            </ion-item>
          }
        </ion-list>
      </ng-template>

      @if (draftWeek(); as week) {
        <ng-container *ngTemplateOutlet="reportRows; context: { $implicit: shown.slice(0, 4) }" />
        <ion-button class="new-report" expand="block" [routerLink]="['/ojt/reports', week]">{{ text.newReport }}</ion-button>
        @if (shown.length > 4) {
          <ng-container *ngTemplateOutlet="reportRows; context: { $implicit: shown.slice(4) }" />
        }
      } @else {
        <ng-container *ngTemplateOutlet="reportRows; context: { $implicit: shown }" />
      }

    </ion-content>
  `,
  styles: `
    ion-content { --background: var(--lb-page); }
    details { margin-bottom: 10px; }
    summary {
      width: fit-content;
      padding: 10px 4px;
      color: var(--ion-color-primary);
      font-size: 0.8125rem;
      font-weight: 650;
      cursor: pointer;
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin: 4px 0 16px;
    }
    ion-segment {
      --background: var(--ion-color-light);
      margin-bottom: 14px;
      border-radius: 8px;
      padding: 3px;
    }
    ion-segment-button {
      --color: var(--ion-color-medium-shade);
      --color-checked: var(--ion-color-primary);
      --indicator-color: var(--ion-color-secondary);
      text-transform: none;
      font-weight: 600;
      font-size: 0.75rem;
      min-width: 0;
      min-height: 40px;
      --padding-start: 5px;
      --padding-end: 5px;
    }
    .empty {
      text-align: center;
      color: var(--ion-color-medium-shade);
      padding: 24px 12px;
      font-size: 0.875rem;
    }
    ion-list {
      background: transparent;
      padding: 0;
    }
    ion-item {
      --background: var(--lb-cream);
      --border-width: 0;
      --border-radius: 12px;
      --padding-start: 14px;
      --inner-padding-end: 12px;
      --min-height: 96px;
      --detail-icon-color: var(--ion-color-primary);
      --detail-icon-opacity: 0.7;
      margin: 0 0 10px;
      border: 1px solid var(--lb-cream-border);
      border-radius: 12px;
    }
    ion-label {
      margin: 14px 0;
    }
    ion-item h2 {
      font-weight: 700;
      font-family: var(--ion-font-family);
      font-size: 0.875rem;
      margin-bottom: 4px;
      color: var(--ion-color-dark);
    }
    ion-item p {
      color: var(--ion-color-medium-shade);
      font-size: 0.75rem;
      line-height: 1.6;
    }
    ion-item p.remark {
      color: var(--ion-color-danger);
      margin-top: 6px;
    }
    app-status-badge {
      margin-left: 10px;
      --lb-badge-min-width: 80px;
      --lb-badge-radius: 8px;
    }
    .new-report {
      margin: 16px 0;
      min-height: 46px;
      --background-hover: var(--ion-color-primary-tint);
      --background-activated: var(--ion-color-primary-shade);
      --color: var(--ion-color-primary-contrast);
    }
    .new-report::part(native) { background: var(--lb-primary-gradient, var(--ion-color-primary)); }
  `,
})
export class ReportsPage {
  protected readonly strings = STRINGS;
  protected readonly text = OJT_STRINGS.reports;
  protected readonly ui = UI_STRINGS;
  protected readonly dateLabel = dateLabel;
  protected readonly filter = signal<Filter>('all');

  private readonly store = inject(WorkStore);

  private readonly rows = computed<Row[]>(() =>
    this.store.weeksOf(this.store.meId()).map((week) => {
      const report = this.store.report(this.store.meId(), week);
      const status = report?.status ?? 'none';
      const last = report?.history[report.history.length - 1];
      return {
        week,
        end: addDays(week, 6),
        minutes: this.store.weekMinutes(this.store.meId(), week),
        status,
        remark: status === 'returned' ? (last?.remark ?? null) : null,
      };
    }),
  );

  protected readonly visible = computed(() => this.rows().filter((r) => matches(this.filter(), r.status)));

  protected readonly draftWeek = computed(() => {
    const current = this.rows()[0];
    return current?.status === 'none' ? current.week : null;
  });

  protected readonly counts = computed(() => {
    const all = this.rows();
    const count = (f: Filter) => all.filter((r) => matches(f, r.status)).length;
    return { todo: count('todo'), submitted: count('submitted'), approved: count('approved') };
  });

  protected shortDateLabel(date: string): string {
    return shortDate.format(new Date(`${date}T00:00:00Z`));
  }

  protected setFilter(event: CustomEvent): void {
    this.filter.set(event.detail.value as Filter);
  }
}
