// (progress-ring.component.ts) Circular progress bar (mood board "progress ring"). Two arcs: the main value, and an optional second
// value behind it (for example, approved hours over logged hours). Colors are Ionic theme colors.
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

@Component({
  selector: 'app-progress-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ring" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() / 9" role="progressbar"
      aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="clamped()" [attr.aria-label]="label()">
      <svg viewBox="0 0 120 120">
        <circle class="track" cx="60" cy="60" [attr.r]="radius" />
        @if (secondary() !== null) {
          <circle class="arc secondary" cx="60" cy="60" [attr.r]="radius"
            [style.stroke]="'var(--ion-color-' + secondaryColor() + ')'"
            [attr.stroke-dasharray]="circumference" [attr.stroke-dashoffset]="offset(secondary()!)" />
        }
        <circle class="arc" cx="60" cy="60" [attr.r]="radius"
          [style.stroke]="'var(--ion-color-' + color() + ')'"
          [attr.stroke-dasharray]="circumference" [attr.stroke-dashoffset]="offset(clamped())" />
      </svg>
      <div class="center">
        <span class="value">{{ valueText() || clamped() + '%' }}</span>
        @if (caption()) {
          <span class="caption">{{ caption() }}</span>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .ring {
      position: relative;
      margin: 0 auto;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }
    circle {
      fill: none;
      stroke-width: 12;
    }
    .track {
      fill: var(--lb-ring-center, none);
      stroke: var(--lb-sky);
    }
    .arc {
      stroke-linecap: butt;
      transition: stroke-dashoffset 0.6s ease;
    }
    .arc.secondary {
      stroke: var(--lb-sky) !important;
    }
    .arc:not(.secondary) {
      stroke: var(--ion-color-primary) !important;
    }
    .center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      text-align: center;
    }
    .value {
      color: var(--ion-color-dark);
      font-family: var(--font-heading);
      font-size: 1.45em;
      font-weight: 800;
      line-height: 1.2;
      font-variant-numeric: tabular-nums;
    }
    .caption {
      max-width: 68%;
      color: var(--ion-color-medium);
      font-size: max(0.52em, 10px);
      line-height: 1.55;
    }
    @media (prefers-reduced-motion: reduce) {
      .arc {
        transition: none;
      }
    }
  `,
})
export class ProgressRingComponent {
  /** Percent, 0 to 100. */
  readonly value = input.required<number>();
  /** Optional second percent behind the main arc. */
  readonly secondary = input<number | null>(null);
  readonly size = input(160);
  readonly color = input('primary');
  readonly secondaryColor = input('primary');
  readonly caption = input('');
  readonly valueText = input('');
  readonly label = input('Progress');

  protected readonly radius = RADIUS;
  protected readonly circumference = CIRCUMFERENCE;
  protected readonly clamped = computed(() => Math.max(0, Math.min(100, Math.round(this.value()))));

  protected offset(percent: number): number {
    return CIRCUMFERENCE * (1 - Math.max(0, Math.min(100, percent)) / 100);
  }
}
