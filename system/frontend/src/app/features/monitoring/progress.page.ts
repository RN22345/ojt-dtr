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
    BarChartComponent,
    StatusBadgeComponent,
  ],
  template: `
    <app-page-header [title]="strings.pages.ojtProgress" />
    <ion-content class="ion-padding">
      @let hours = progress();
      <app-progress-ring
        [value]="hours.percent"
        [secondary]="hours.loggedPercent"
        [size]="138"
        color="primary"
        secondaryColor="primary"
        [caption]="ui.hoursOf(hours.approvedMinutes, hours.requiredMinutes)"
      />

      <h2>{{ text.weeks }}</h2>
      <ion-card class="weekly-chart">
        <ion-card-content>
          @if (bars().length === 0) {
            <p>{{ text.noWeeks }}</p>
          } @else {
            <app-bar-chart [items]="bars()" [selected]="selected()" [height]="150" [label]="text.weeks" (barSelect)="select($event)" />
            <ul class="legend" [attr.aria-label]="text.legend">
              <li><span class="dot success"></span>{{ text.legendApproved }}</li>
              <li><span class="dot warning"></span>{{ text.legendSubmitted }}</li>
              <li><span class="dot danger"></span>{{ text.legendReturned }}</li>
              <li><span class="dot medium"></span>{{ text.legendOther }}</li>
            </ul>
          }
          <p class="strip"><strong>{{ text.totalHours }}</strong><strong>{{ ui.hours(hours.loggedMinutes) }}</strong></p>
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


      <dl class="tiles">
        <div><dt>{{ home.logged }}</dt><dd>{{ ui.hours(hours.loggedMinutes) }}</dd></div>
        <div class="approved"><dt>{{ home.approved }}</dt><dd>{{ ui.hours(hours.approvedMinutes) }}</dd></div>
      </dl>
      <dl class="progress-details">
        <div><dt>{{ home.remaining }}</dt><dd>{{ ui.hours(hours.remainingMinutes) }}</dd></div>
        <div><dt>{{ text.projectedEnd }}</dt><dd>{{ endText() }}</dd></div>
      </dl>

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
    ion-content { --background: var(--lb-page); }
    app-progress-ring {
      --lb-ring-center: var(--lb-panel);
      display: block;
      margin: 4px 0 28px;
    }
    h2, h3 { margin: 0 0 14px; font-size: 1rem; color: var(--ion-color-dark); }
    ion-card, .tiles > div, .progress-details, ion-item {
      background: var(--lb-panel);
      border: 1px solid var(--lb-panel-border);
      border-radius: 12px;
    }
    ion-card { margin: 0 0 18px; }
    ion-card-content { padding: 10px 12px; }
    .weekly-chart ion-card-content { padding: 10px; }
    .strip, .progress-details > div {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .strip {
      margin: 10px 0 0;
      padding: 6px 8px;
      border-radius: 6px;
      background: var(--ion-color-light);
      color: var(--ion-color-primary);
    }
    .strip::before { content: ''; width: 4px; height: 1em; border-radius: 2px; background: currentColor; }
    .strip strong:first-of-type { margin-inline-end: auto; }
    .tiles, .progress-details {
      display: grid;
      gap: 10px;
      margin: 0 0 14px;
    }
    .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .tiles > div { display: grid; gap: 3px; padding: 12px; }
    .tiles dt { order: 1; color: var(--ion-color-medium-shade); font-size: 0.75rem; }
    .tiles dd {
      margin: 0;
      font: 800 1.35rem var(--font-heading);
      color: var(--ion-color-dark);
    }
    .tiles .approved dd { color: var(--ion-color-success-shade); }
    .progress-details {
      padding: 10px 12px;
      color: var(--ion-color-medium-shade);
      font-size: 0.75rem;
    }
    .progress-details dd { margin: 0; color: var(--ion-color-primary); font-weight: 700; }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      list-style: none;
      padding: 0;
      margin: 10px 0 0;
      font-size: 0.6875rem;
      color: var(--ion-color-medium-shade);
    }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-inline-end: 4px; }
    .dot.success { background: var(--ion-color-success); }
    .dot.warning { background: var(--ion-color-warning); }
    .dot.danger { background: var(--ion-color-danger); }
    .dot.medium { background: var(--ion-color-medium); }
    ion-list { padding: 0; }
    ion-item {
      --min-height: 64px;
      --background: var(--lb-panel);
      --border-width: 0;
      --padding-start: 14px;
      --inner-padding-end: 12px;
      margin-bottom: 8px;
    }
    ion-item h2 {
      font-family: var(--ion-font-family);
      font-size: 0.8125rem;
      font-weight: 600;
      margin-bottom: 8px;
    }
    ion-item p { font-size: 0.6875rem; color: var(--ion-color-medium-shade); }
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
