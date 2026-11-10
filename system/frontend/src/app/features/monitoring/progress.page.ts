// OJT progress: hours, expected last day, and hours for each week with the report status (FR-MON-01).
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonCard, IonCardContent, IonContent, IonItem, IonLabel, IonList } from '@ionic/angular';
import { WorkStore } from '../../data/store/work-store.service';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { STRINGS } from '../../shared/strings';
import { OJT_STRINGS } from '../../shared/strings-ojt';
import { UI_STRINGS } from '../../shared/strings-ui';
import { BarChartComponent, BarItem } from '../../shared/ui/bar-chart.component';
import { ProgressRingComponent } from '../../shared/ui/progress-ring.component';
import { StatTileComponent } from '../../shared/ui/stat-tile.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { dateLabel } from '../../shared/utils/format';

const STATUS_COLOR: Record<string, string> = { approved: 'success', submitted: 'warning', returned: 'danger' };

@Component({
  selector: 'app-progress-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    IonContent,
    IonCard,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    RouterLink,
    ProgressRingComponent,
    StatTileComponent,
    BarChartComponent,
    StatusBadgeComponent,
  ],
  template: `
    <app-page-header [title]="strings.pages.ojtProgress" />
    <ion-content class="ion-padding">
      <app-progress-ring
        [value]="progress().percent"
        [secondary]="progress().loggedPercent"
        [size]="190"
        [caption]="ui.hoursOf(progress().approvedMinutes, progress().requiredMinutes)"
      />
      <div class="tiles">
        <app-stat-tile [label]="home.logged" [value]="ui.hours(progress().loggedMinutes)" color="primary" />
        <app-stat-tile [label]="home.approved" [value]="ui.hours(progress().approvedMinutes)" color="success" />
        <app-stat-tile [label]="home.remaining" [value]="ui.hours(progress().remainingMinutes)" color="medium" />
      </div>
      <p class="end">
        <strong>{{ text.projectedEnd }}:</strong>
        {{ endText() }}
      </p>

      <ion-card>
        <ion-card-content>
          <h3>{{ text.weeks }}</h3>
          @if (bars().length === 0) {
            <p>{{ text.noWeeks }}</p>
          } @else {
            <app-bar-chart [items]="bars()" [selected]="selected()" [height]="170" [label]="text.weeks" (barSelect)="select($event)" />
            <ul class="legend" [attr.aria-label]="text.legend">
              <li><span class="dot success"></span>{{ text.legendApproved }}</li>
              <li><span class="dot warning"></span>{{ text.legendSubmitted }}</li>
              <li><span class="dot danger"></span>{{ text.legendReturned }}</li>
              <li><span class="dot medium"></span>{{ text.legendOther }}</li>
            </ul>
          }
        </ion-card-content>
      </ion-card>

      @if (selectedWeek(); as week) {
        <ion-card>
          <ion-card-content>
            <h3>{{ text.selectedWeek(dateLabel(week)) }}</h3>
            <app-bar-chart [items]="dayBars()" [target]="8" [targetText]="home.target" [height]="120" [label]="text.selectedWeek(week)" />
          </ion-card-content>
        </ion-card>
      }

      <h3>{{ text.weekList }}</h3>
      <ion-list>
        @for (row of rows(); track row.week) {
          <ion-item [routerLink]="['/ojt/reports', row.week]" detail>
            <ion-label>
              <h2>{{ text.selectedWeek(dateLabel(row.week)) }}</h2>
              <p>{{ ui.hours(row.minutes) }}</p>
            </ion-label>
            <app-status-badge slot="end" [status]="row.status" />
          </ion-item>
        }
      </ion-list>

    </ion-content>
  `,
  styles: `
    app-progress-ring {
      margin: 20px 0 24px;
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-2);
      margin: 18px 0;
    }
    .end {
      padding: var(--space-3);
      border-radius: 9px;
      background: var(--ion-color-light);
      text-align: center;
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--ion-color-medium-shade);
    }
    .end strong {
      color: var(--ion-color-primary);
    }
    ion-card {
      margin: 18px 0;
    }
    h3 {
      margin: 20px 0 var(--space-3);
      font-size: 1rem;
      font-weight: 700;
      color: var(--ion-color-primary);
    }
    ion-card h3 {
      margin-top: 0;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      margin: 10px 0 0;
      padding: 0;
      list-style: none;
      font-size: 0.75rem;
      color: var(--ion-color-medium-shade);
    }
    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-right: var(--space-1);
      border-radius: 50%;
    }
    .dot.success {
      background: var(--ion-color-success);
    }
    .dot.warning {
      background: var(--ion-color-warning);
    }
    .dot.danger {
      background: var(--ion-color-danger);
    }
    .dot.medium {
      background: var(--ion-color-medium);
    }
    ion-item {
      --min-height: 76px;
      --background: var(--lb-cream);
      --border-width: 0;
      --padding-start: 14px;
      --inner-padding-end: var(--space-3);
      margin-bottom: var(--space-2);
      border: 1px solid var(--lb-cream-border);
      border-radius: 10px;
    }
    ion-item h2 {
      margin-bottom: var(--space-2);
      font-family: var(--ion-font-family);
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--ion-color-dark);
    }
    ion-item p {
      font-size: 0.75rem;
      color: var(--ion-color-medium-shade);
    }
  `,
})
export class ProgressPage {
  protected readonly strings = STRINGS;
  protected readonly text = OJT_STRINGS.progress;
  protected readonly home = OJT_STRINGS.home;
  protected readonly ui = UI_STRINGS;
  protected readonly dateLabel = dateLabel;
  protected readonly selected = signal<number | null>(null);

  private readonly store = inject(WorkStore);

  protected readonly progress = computed(() => this.store.progress(this.store.meId()));
  protected readonly endText = computed(() => {
    const end = this.progress().projectedEnd;
    return end ? dateLabel(end) : this.text.noProjection;
  });

  /** Newest first, for the list. */
  protected readonly rows = computed(() =>
    this.store.weeksOf(this.store.meId()).map((week) => ({
      week,
      minutes: this.store.weekMinutes(this.store.meId(), week),
      status: this.store.report(this.store.meId(), week)?.status ?? 'none',
    })),
  );

  /** Oldest first, for the chart. */
  private readonly chartRows = computed(() => [...this.rows()].reverse());

  protected readonly bars = computed<BarItem[]>(() =>
    this.chartRows().map((r) => ({
      label: r.week.slice(5),
      value: r.minutes / 60,
      valueText: String(Math.round(r.minutes / 6) / 10),
      color: STATUS_COLOR[r.status] ?? 'medium',
    })),
  );

  protected readonly selectedWeek = computed(() => {
    const i = this.selected();
    return i === null ? null : (this.chartRows()[i]?.week ?? null);
  });

  protected readonly dayBars = computed<BarItem[]>(() => {
    const week = this.selectedWeek();
    return week
      ? this.store.weekDays(this.store.meId(), week).map((d, i) => ({
          label: UI_STRINGS.weekdayShort[i],
          value: d.minutes / 60,
          valueText: d.minutes ? String(Math.round(d.minutes / 6) / 10) : '',
        }))
      : [];
  });

  protected select(index: number): void {
    this.selected.set(index);
  }
}
