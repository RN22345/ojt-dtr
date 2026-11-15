import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { calendarOutline, chevronBackOutline, chevronDownOutline, chevronForwardOutline } from 'ionicons/icons';
import { STRINGS } from '../../shared/strings';
import { dateLabel, duration } from '../../shared/utils/format';
import { localDate, weekStart } from '../../shared/utils/hours';
import type { HistoryWeek } from './dtr-history';

addIcons({ calendarOutline, chevronBackOutline, chevronDownOutline, chevronForwardOutline });

// Work dates have already been converted to Manila dates. Use UTC to step through those dates.
const monthFormat = new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const weekdayFormat = new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', weekday: 'short' });
// The first seven dates in this reference week are Sunday through Saturday.
const weekdays = Array.from({ length: 7 }, (_, index) => weekdayFormat.format(new Date(Date.UTC(1970, 0, 4 + index))));

function calendarDate(date: string): Date {
  return new Date(date + 'T00:00:00Z');
}

function dayAt(start: Date, offset: number): Date {
  const day = new Date(start);
  day.setUTCDate(start.getUTCDate() + offset);
  return day;
}

function dateKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-dtr-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  template: `
    <section class="calendar" [attr.aria-label]="text.calendar">
      <div class="calendar-header">
        <h2>
          <button type="button" class="toggle" [attr.aria-expanded]="expanded()" aria-controls="dtr-full-month" (click)="toggle()">
            <ion-icon name="calendar-outline" aria-hidden="true" />
            <span aria-live="polite">{{ monthTitle() }}</span>
            <ion-icon class="chevron" name="chevron-down-outline" aria-hidden="true" />
          </button>
        </h2>
        @if (expanded()) {
          <div class="month-controls">
            <button type="button" [attr.aria-label]="text.previousMonth" (click)="moveMonth(-1)">
              <ion-icon name="chevron-back-outline" aria-hidden="true" />
            </button>
            <button type="button" [attr.aria-label]="text.nextMonth" (click)="moveMonth(1)">
              <ion-icon name="chevron-forward-outline" aria-hidden="true" />
            </button>
          </div>
        }
      </div>

      @if (!expanded()) {
        <ul class="week" [attr.aria-label]="text.workweek">
          @for (day of workdays(); track day.date) {
            <li>
              <time class="date" [attr.datetime]="day.date" [attr.aria-label]="day.label" [attr.aria-current]="day.today ? 'date' : null">
                <span>{{ day.weekday }}</span>
                <strong>{{ day.number }}</strong>
              </time>
            </li>
          }
        </ul>
      }

      <div id="dtr-full-month" [hidden]="!expanded()">
        @if (expanded()) {
          <div class="weekday-headings" aria-hidden="true">
            @for (weekday of weekdays; track weekday) {
              <span>{{ weekday }}</span>
            }
          </div>
          <ul class="month" [attr.aria-label]="monthTitle()">
            @for (day of monthDays(); track $index) {
              @if (day) {
                <li>
                  <time class="date" [attr.datetime]="day.date" [attr.aria-label]="day.label" [attr.aria-current]="day.today ? 'date' : null">
                    <strong>{{ day.number }}</strong>
                    @if (day.hours) {
                      <span class="logged">{{ day.hours }}</span>
                    }
                  </time>
                </li>
              } @else {
                <li aria-hidden="true"></li>
              }
            }
          </ul>
        }
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }
    .calendar {
      margin: 16px 8px 23px;
      padding: 4px 8px 13px;
      background: var(--lb-panel);
      border: 1px solid var(--lb-panel-border);
      border-radius: 11px;
    }
    .calendar-header, .toggle, .month-controls {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    h2 { flex: 1; min-width: 0; margin: 0; font-size: 1rem; }
    button {
      min-height: 44px;
      color: var(--ion-color-primary);
      border-radius: 8px;
      cursor: pointer;
    }
    .toggle {
      width: 100%;
      padding: 4px 1px;
      background: transparent;
      text-align: start;
      font: inherit;
    }
    ion-icon { flex-shrink: 0; }
    .chevron { margin-inline-start: auto; }
    .toggle[aria-expanded='true'] .chevron { transform: rotate(180deg); }
    .month-controls { gap: 3px; }
    .month-controls button {
      display: grid;
      place-items: center;
      min-width: 44px;
      background: var(--ion-color-light);
      font-size: 1rem;
    }
    ul { padding: 0; margin: 0; list-style: none; }
    .week, .month, .weekday-headings { display: grid; }
    .week {
      grid-template-columns: repeat(5, minmax(0, 42px));
      justify-content: center;
      gap: 10px;
      margin-top: 1px;
    }
    .month, .weekday-headings {
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 4px;
    }
    .weekday-headings {
      padding-block: 8px 5px;
      color: var(--ion-color-medium-shade);
      font-size: 0.6875rem;
      text-align: center;
    }
    .date {
      display: grid;
      align-content: center;
      gap: 2px;
      min-height: 56px;
      padding: 4px 1px;
      border-radius: 11px;
      background: var(--ion-color-light);
      color: var(--ion-color-dark);
      text-align: center;
      font-size: 0.6875rem;
    }
    .date strong { font: 700 1rem / 1.25 var(--font-heading); }
    .month .date { min-height: 45px; height: 100%; }
    .month .date strong { font-size: 0.875rem; }
    .logged { color: var(--ion-color-success-shade); font-size: 0.625rem; font-weight: 700; }
    [aria-current='date'] { background: var(--lb-primary-gradient); color: var(--ion-color-primary-contrast); }
    [aria-current='date'] .logged { color: inherit; }
  `,
})
export class DtrCalendarComponent {
  readonly weeks = input.required<readonly HistoryWeek[]>();

  protected readonly text = STRINGS.dtr;
  protected readonly weekdays = weekdays;
  protected readonly expanded = signal(false);

  private readonly now = signal(new Date());
  private readonly monthOffset = signal(0);
  private readonly today = computed(() => localDate(this.now()));
  private readonly displayedMonth = computed(() => {
    const start = calendarDate(this.today().slice(0, 7) + '-01');
    start.setUTCMonth(start.getUTCMonth() + this.monthOffset());
    return start;
  });
  private readonly loggedByDate = computed(() =>
    new Map(this.weeks().flatMap((week) => week.days.map((day) => [day.date, day.minutes] as const))),
  );

  protected readonly monthTitle = computed(() => monthFormat.format(this.displayedMonth()));
  protected readonly workdays = computed(() => {
    const monday = calendarDate(weekStart(this.now()));
    return Array.from({ length: 5 }, (_, index) => {
      const day = dayAt(monday, index);
      return { ...this.describeDay(day), weekday: weekdayFormat.format(day) };
    });
  });
  protected readonly monthDays = computed(() => {
    const start = this.displayedMonth();
    const lastDay = new Date(start);
    lastDay.setUTCMonth(start.getUTCMonth() + 1, 0);
    const leadingCells = start.getUTCDay();
    const logged = this.loggedByDate();

    return Array.from({ length: leadingCells + lastDay.getUTCDate() }, (_, index) => {
      if (index < leadingCells) {
        return null;
      }
      const day = dayAt(start, index - leadingCells);
      return this.describeDay(day, logged);
    });
  });

  protected toggle(): void {
    this.now.set(new Date());
    this.monthOffset.set(0);
    this.expanded.update((open) => !open);
  }

  protected moveMonth(direction: -1 | 1): void {
    this.monthOffset.update((offset) => offset + direction);
  }

  private describeDay(day: Date, logged?: ReadonlyMap<string, number>) {
    const date = dateKey(day);
    const label = dateLabel(date);
    const minutes = logged?.get(date) ?? 0;
    return {
      date,
      number: day.getUTCDate(),
      today: date === this.today(),
      label: minutes > 0 ? this.text.calendarDayHours(label, duration(minutes)) : label,
      hours: minutes > 0 ? this.text.calendarHours(Math.floor(minutes / 60), minutes % 60) : '',
    };
  }
}
