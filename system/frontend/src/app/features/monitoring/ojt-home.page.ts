// OJT home: hours progress, hours of this week, report status, and quick actions (FR-MON-01).
// Data comes from the prototype store (sample data).
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonItem, IonLabel, IonList, IonNote } from '@ionic/angular';
import { checkmarkCircleOutline, hourglassOutline } from 'ionicons/icons';
import { ME, addDays } from '../../data/mock/mock-data';
import { MockStore } from '../../data/mock/mock-store.service';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { STRINGS } from '../../shared/strings';
import { OJT_STRINGS } from '../../shared/strings-ojt';
import { UI_STRINGS } from '../../shared/strings-ui';
import { BarChartComponent, BarItem } from '../../shared/ui/bar-chart.component';
import { ProgressRingComponent } from '../../shared/ui/progress-ring.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { localDate, weekStart } from '../../shared/utils/hours';

const DAY_MS = 86_400_000;

@Component({
  selector: 'app-ojt-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    IonContent,
    IonCard,
    IonCardContent,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    RouterLink,
    ProgressRingComponent,
    BarChartComponent,
    StatusBadgeComponent,
  ],
  template: `
    <app-page-header [title]="strings.pages.ojtHome" />
    <ion-content class="ion-padding">
      @let hours = progress();
      @let days = daysToEnd();
      <section class="panel greeting" aria-labelledby="home-greeting">
        <div class="identity">
          <h2 id="home-greeting">{{ text.greeting(store.me().fullName) }}</h2>
          <p>{{ text.role }} · {{ store.me().companyName }}</p>
        </div>
        <div class="countdown">
          @if (days !== null) {
            <div><strong>{{ days }}</strong><span>{{ text.daysToEnd }}</span></div>
          }
          <div><strong>{{ ui.hours(hoursToLog()) }}</strong><span>{{ text.hoursToLog }}</span></div>
        </div>
      </section>

      <section class="panel" aria-labelledby="attendance-title">
        <h2 id="attendance-title">{{ text.attendance }}</h2>
        <dl class="attendance-grid">
          <div class="recorded">
            <dt>{{ text.recordedDays }}</dt>
            <dd><ion-icon [icon]="icons.checkmarkCircleOutline" aria-hidden="true" />{{ recordedDays() }}</dd>
          </div>
          <div class="pending">
            <dt>{{ text.pendingCorrections }}</dt>
            <dd><ion-icon [icon]="icons.hourglassOutline" aria-hidden="true" />{{ pendingCorrections() }}</dd>
          </div>
        </dl>
      </section>

      <section class="panel" aria-labelledby="ojt-progress-title">
        <h2 id="ojt-progress-title">{{ text.progressTitle }}</h2>
        <div class="progress-grid">
          <app-progress-ring
            [value]="hours.percent"
            [secondary]="hours.loggedPercent"
            [size]="120"
            [valueText]="ui.hours(hours.loggedMinutes)"
            [caption]="text.completed(hours.percent)"
            [label]="text.progressTitle"
            color="primary"
            secondaryColor="primary"
          />
          <dl class="hours-list">
            <div><dt>{{ text.hoursLogged }}</dt><dd>{{ ui.hours(hours.loggedMinutes) }}</dd></div>
            <div class="approved"><dt>{{ text.approved }}</dt><dd>{{ ui.hours(hours.approvedMinutes) }}</dd></div>
            <div><dt>{{ text.remaining }}</dt><dd>{{ ui.hours(hours.remainingMinutes) }}</dd></div>
          </dl>
        </div>
        <p class="strip"><strong>{{ text.requiredHours }}</strong><strong>{{ ui.hours(hours.requiredMinutes) }}</strong></p>
      </section>

      <ion-button class="open-dtr" expand="block" routerLink="/ojt/dtr">{{ text.quickDtr }}</ion-button>

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

      <ion-note class="proto">{{ ui.prototypeNote }}</ion-note>
    </ion-content>
  `,
  styles: `
    ion-content { --background: var(--lb-page); }
    .panel, ion-card {
      margin: 0 0 16px;
      background: var(--lb-panel);
      border: 1px solid var(--lb-panel-border);
      border-radius: 12px;
    }
    .panel { padding: 10px 12px; }
    h2, h3 { margin: 0 0 8px; font-size: 0.9rem; color: var(--ion-color-primary); }
    .greeting, .countdown, .status-row, .strip, .hours-list > div {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .greeting { margin-top: 12px; gap: 14px; }
    .identity { order: 1; flex: 1; min-width: 0; }
    .identity h2 {
      color: var(--ion-color-dark);
      font-size: clamp(1rem, 5vw, 1.4rem);
      overflow-wrap: anywhere;
    }
    .identity p, dt, .countdown span {
      font-size: 0.625rem;
      line-height: 1.35;
      color: var(--ion-color-medium-shade);
    }
    .identity p, dl, dd { margin: 0; }
    .countdown > div + div {
      padding-inline-start: 8px;
      border-inline-start: 1px solid var(--lb-panel-border);
    }
    .countdown strong, .countdown span { display: block; }
    .countdown strong {
      font: 800 clamp(1rem, 5vw, 1.75rem) var(--font-heading);
      color: var(--ion-color-primary);
    }
    .countdown > div:last-child strong { color: var(--ion-color-secondary-shade); }
    .countdown span { width: min-content; min-width: 58px; text-transform: uppercase; font-weight: 700; }
    .attendance-grid, .progress-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .attendance-grid > div {
      display: grid;
      justify-items: center;
      gap: 2px;
      padding: 6px;
      border-radius: 10px;
      text-align: center;
    }
    .recorded { color: var(--ion-color-success-shade); background: var(--lb-online); }
    .pending { color: var(--ion-color-secondary-shade); background: var(--lb-cream); }
    .attendance-grid dt { order: 1; }
    .attendance-grid dd { display: grid; justify-items: center; font: 800 1.15rem var(--font-heading); }
    .attendance-grid ion-icon { font-size: 0.875rem; }
    .progress-grid { align-items: center; margin-bottom: 8px; }
    app-progress-ring {
      justify-self: start;
      border-radius: 50%;
      background: var(--ion-color-light);
      padding: 5px;
    }
    .hours-list { display: grid; gap: 6px; }
    .hours-list > div, .strip { background: var(--ion-color-light); border-radius: 6px; }
    .hours-list > div { border: 1px solid var(--lb-panel-border); padding: 5px 6px; }
    .hours-list dd { flex-shrink: 0; color: var(--ion-color-dark); font-size: 0.75rem; font-weight: 700; }
    .hours-list .approved dd { color: var(--ion-color-success-shade); }
    .strip { margin: 0; padding: 6px 8px; color: var(--ion-color-primary); font-size: 0.8rem; }
    .strip::before { content: ''; width: 4px; height: 1em; border-radius: 2px; background: currentColor; }
    .strip strong:first-of-type { margin-inline-end: auto; }
    .open-dtr { min-height: 44px; font-size: 1.05rem; margin: 0 4px 20px; }
    .open-dtr::part(native) { background: var(--lb-amber-gradient); }
    ion-card-content { padding: 12px; }
    .status-row ion-button { flex-shrink: 0; }
    .total { text-align: end; margin: 8px 0 0; font-size: 0.75rem; color: var(--ion-color-primary); }
    ion-list { padding: 0; }
    ion-item {
      --background: var(--lb-panel);
      --min-height: 44px;
      --border-width: 0;
      margin-bottom: 8px;
      border-radius: 8px;
      font-size: 0.875rem;
    }
    .proto { display: block; margin: 16px 0 8px; font-size: 0.6875rem; }
  `,
})
export class OjtHomePage {
  protected readonly strings = STRINGS;
  protected readonly text = OJT_STRINGS.home;
  protected readonly ui = UI_STRINGS;
  protected readonly store = inject(MockStore);
  protected readonly icons = { checkmarkCircleOutline, hourglassOutline };

  protected readonly actions = [
    { label: this.text.quickCorrections, link: '/ojt/corrections' },
    { label: this.text.quickExport, link: '/ojt/export' },
    { label: this.text.quickProgress, link: '/ojt/progress' },
  ];

  protected readonly progress = computed(() => this.store.progress(ME));
  protected readonly hoursToLog = computed(() => Math.max(0, this.progress().requiredMinutes - this.progress().loggedMinutes));
  protected readonly daysToEnd = computed(() => {
    const end = this.progress().projectedEnd;
    return end ? Math.max(0, (Date.parse(end) - Date.parse(localDate(new Date()))) / DAY_MS) : null;
  });
  protected readonly recordedDays = computed(() =>
    Object.values(this.store.me().dailyMinutes).filter((minutes) => minutes > 0).length,
  );
  protected readonly pendingCorrections = computed(() =>
    this.store.correctionsOf(ME).filter((request) => request.status === 'pending').length,
  );
  private readonly thisWeek = weekStart(new Date());
  private readonly days = computed(() => this.store.weekDays(ME, this.thisWeek));
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
      { week: this.thisWeek, title: this.text.reportThisWeek, status: this.store.report(ME, this.thisWeek)?.status ?? 'none' },
      { week: lastWeek, title: this.text.reportLastWeek, status: this.store.report(ME, lastWeek)?.status ?? 'none' },
    ];
  });
}
