// OJT home: hours progress, hours of this week, report status, and quick actions (FR-MON-01).
// Data comes from the prototype store (sample data).
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonCard, IonCardContent, IonContent, IonItem, IonLabel, IonList } from '@ionic/angular';
import { addDays } from '../../data/store/store-models';
import { WorkStore } from '../../data/store/work-store.service';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { STRINGS } from '../../shared/strings';
import { OJT_STRINGS } from '../../shared/strings-ojt';
import { UI_STRINGS } from '../../shared/strings-ui';
import { BarChartComponent, BarItem } from '../../shared/ui/bar-chart.component';
import { ProgressRingComponent } from '../../shared/ui/progress-ring.component';
import { StatTileComponent } from '../../shared/ui/stat-tile.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { weekStart } from '../../shared/utils/hours';

@Component({
  selector: 'app-ojt-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    IonContent,
    IonCard,
    IonCardContent,
    IonButton,
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
    <app-page-header [title]="strings.pages.ojtHome" />
    <ion-content class="ion-padding">
      <h2>{{ text.greeting(store.me().fullName) }}</h2>
      <p class="company">{{ store.me().companyName }}</p>

      <app-progress-ring
        [value]="progress().percent"
        [secondary]="progress().loggedPercent"
        [size]="190"
        [caption]="ui.hoursOf(progress().approvedMinutes, progress().requiredMinutes)"
      />

      <div class="tiles">
        <app-stat-tile [label]="text.logged" [value]="ui.hours(progress().loggedMinutes)" color="primary" />
        <app-stat-tile [label]="text.approved" [value]="ui.hours(progress().approvedMinutes)" color="success" />
        <app-stat-tile [label]="text.remaining" [value]="ui.hours(progress().remainingMinutes)" color="medium" />
      </div>

      <ion-card>
        <ion-card-content>
          <h3>{{ text.thisWeek }}</h3>
          <app-bar-chart [items]="bars()" [target]="8" [targetText]="text.target" [height]="150" [label]="text.thisWeek" />
          <p class="total">{{ text.weekTotal(ui.hours(weekTotal())) }}</p>
        </ion-card-content>
      </ion-card>

      @for (row of reportRows(); track row.week) {
        <ion-card>
          <ion-card-content class="status-row">
            <div>
              <h3>{{ row.title }}</h3>
              <app-status-badge [status]="row.status" />
            </div>
            <ion-button size="small" fill="outline" [routerLink]="['/ojt/reports', row.week]">{{ text.open }}</ion-button>
          </ion-card-content>
        </ion-card>
      }

      <h3>{{ text.quick }}</h3>
      <ion-list>
        @for (action of actions; track action.link) {
          <ion-item [routerLink]="action.link" detail>
            <ion-label>{{ action.label }}</ion-label>
          </ion-item>
        }
      </ion-list>

    </ion-content>
  `,
  styles: `
    h2 {
      margin: var(--space-3) 0 var(--space-1);
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--ion-color-dark);
    }
    .company {
      margin: 0 0 20px;
      font-size: 0.875rem;
      color: var(--ion-color-medium-shade);
    }
    app-progress-ring {
      margin: 6px 0 22px;
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-2);
      margin: 18px 0 22px;
    }
    ion-card {
      margin: var(--space-3) 0;
    }
    .total {
      margin: var(--space-2) 0 0;
      text-align: right;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--ion-color-primary);
      font-variant-numeric: tabular-nums;
    }
    .status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }
    .status-row h3 {
      color: var(--ion-color-dark);
    }
    .status-row ion-button {
      flex-shrink: 0;
      font-size: 0.75rem;
    }
    h3 {
      margin: 20px 0 10px;
      font-size: 1rem;
      font-weight: 700;
      color: var(--ion-color-primary);
    }
    ion-card h3 {
      margin: 0 0 var(--space-2);
    }
    ion-item {
      --min-height: 48px;
      --background: var(--ion-color-light);
      --border-width: 0;
      --padding-start: 14px;
      --inner-padding-end: 14px;
      margin-bottom: var(--space-2);
      border-radius: 10px;
      font-weight: 600;
    }
    /* The first quick action is the main action */
    ion-item:first-child {
      --background: var(--ion-color-secondary);
      --color: var(--ion-color-secondary-contrast);
      --detail-icon-color: var(--ion-color-secondary-contrast);
      --detail-icon-opacity: 1;
    }
  `,
})
export class OjtHomePage {
  protected readonly strings = STRINGS;
  protected readonly text = OJT_STRINGS.home;
  protected readonly ui = UI_STRINGS;
  protected readonly store = inject(WorkStore);

  protected readonly actions = [
    { label: this.text.quickDtr, link: '/ojt/dtr' },
    { label: this.text.quickCorrections, link: '/ojt/corrections' },
    { label: this.text.quickExport, link: '/ojt/export' },
    { label: this.text.quickProgress, link: '/ojt/progress' },
  ];

  protected readonly progress = computed(() => this.store.progress(this.store.meId()));
  private readonly thisWeek = weekStart(new Date());
  private readonly days = computed(() => this.store.weekDays(this.store.meId(), this.thisWeek));
  protected readonly weekTotal = computed(() => this.days().reduce((sum, d) => sum + d.minutes, 0));
  protected readonly bars = computed<BarItem[]>(() =>
    this.days().map((d, i) => ({
      label: UI_STRINGS.weekdayShort[i],
      value: d.minutes / 60,
      valueText: d.minutes ? String(Math.round(d.minutes / 6) / 10) : '',
      color: 'primary',
    })),
  );

  protected readonly reportRows = computed(() => {
    const lastWeek = addDays(this.thisWeek, -7);
    return [
      { week: this.thisWeek, title: this.text.reportThisWeek, status: this.store.report(this.store.meId(), this.thisWeek)?.status ?? 'none' },
      { week: lastWeek, title: this.text.reportLastWeek, status: this.store.report(this.store.meId(), lastWeek)?.status ?? 'none' },
    ];
  });
}
