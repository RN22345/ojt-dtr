// Bar chart (mood board "bar chart"): one bar for each item, with an optional target line.
// Tap a bar to select it. The parent gets the index of the selected bar.
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface BarItem {
  label: string;
  value: number;
  /** Text above the bar, for example "8.0". */
  valueText?: string;
  /** Ionic color name. Default: primary. */
  color?: string;
}

@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" [style.height.px]="height()" role="list" [attr.aria-label]="label()">
      @if (target() !== null && max() > 0) {
        <div class="target" [style.bottom.%]="(target()! / max()) * 100">
          <span>{{ targetText() }}</span>
        </div>
      }
      @for (item of items(); track $index) {
        <button type="button" class="col" role="listitem" [class.selected]="selected() === $index"
          [attr.aria-label]="item.label + ': ' + (item.valueText ?? item.value)" (click)="barSelect.emit($index)">
          <span class="value">{{ item.valueText ?? item.value }}</span>
          <span class="bar" [style.height.%]="max() ? (item.value / max()) * 100 : 0"
            [style.background]="'var(--ion-color-' + (item.color ?? 'primary') + ')'"></span>
          <span class="label">{{ item.label }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .chart {
      position: relative;
      display: flex;
      align-items: stretch;
      gap: 10px;
      box-sizing: border-box;
      padding: 0 var(--space-2);
      border-top: 24px solid transparent;
      border-bottom: 24px solid transparent;
    }
    .col {
      position: relative;
      display: flex;
      flex: 1;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      min-width: 0;
      padding: 0;
      border: 0;
      border-radius: 3px;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .col:focus-visible {
      outline: 2px solid var(--ion-color-primary);
      outline-offset: 4px;
    }
    .bar {
      flex-shrink: 0;
      width: 74%;
      max-width: 44px;
      min-height: 2px;
      border-radius: 4px 4px 0 0;
      transition: height 0.4s ease;
    }
    .selected .bar {
      outline: 2px solid var(--ion-color-secondary);
      outline-offset: 2px;
    }
    .value {
      flex-shrink: 0;
      margin-bottom: 3px;
      color: var(--ion-color-primary);
      font-size: 0.75rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .label {
      position: absolute;
      top: 100%;
      max-width: 100%;
      margin-top: 6px;
      overflow: hidden;
      color: var(--ion-color-medium-shade);
      font-size: 0.75rem;
      line-height: 1.3;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .target {
      position: absolute;
      right: var(--space-2);
      left: var(--space-2);
      border-top: 1px dashed var(--ion-color-secondary);
      pointer-events: none;
    }
    .target span {
      position: absolute;
      top: -1.4em;
      right: 0;
      color: var(--ion-color-primary);
      font-size: 0.75rem;
      font-weight: 500;
    }
    @media (prefers-reduced-motion: reduce) {
      .bar {
        transition: none;
      }
    }
  `,
})
export class BarChartComponent {
  readonly items = input.required<BarItem[]>();
  readonly height = input(160);
  /** A dashed line at this value, for example the hours of a full work day. */
  readonly target = input<number | null>(null);
  readonly targetText = input('');
  readonly selected = input<number | null>(null);
  readonly label = input('Chart');
  readonly barSelect = output<number>();

  protected readonly max = computed(() => Math.max(this.target() ?? 0, ...this.items().map((i) => i.value), 0));
}
