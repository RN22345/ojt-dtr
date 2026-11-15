// (stat-tile.component.ts) A small number tile: a label, a large value, and an optional note (for example "Logged hours: 212.5").
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tile" [style.border-left-color]="'var(--ion-color-' + color() + ')'">
      <span class="label">{{ label() }}</span>
      <span class="value">{{ value() }}</span>
      @if (note()) {
        <span class="note">{{ note() }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: 4px;
      height: 100%;
      padding: 14px 12px;
      border-left: 0 solid;
      border-radius: 9px;
      background: var(--ion-color-light);
    }
    .value {
      order: 1;
      color: var(--ion-color-primary);
      font-family: var(--font-heading);
      font-size: clamp(1rem, 4vw, 1.35rem);
      font-weight: 700;
      line-height: 1.25;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    :host([color='success']) .value {
      color: var(--ion-color-success);
    }
    :host([color='danger']) .value {
      color: var(--ion-color-danger);
    }
    .label {
      order: 2;
      color: var(--ion-color-medium-shade);
      font-size: 0.625rem;
      line-height: 1.45;
    }
    .note {
      order: 3;
      color: var(--ion-color-medium-shade);
      font-size: 0.625rem;
      line-height: 1.45;
    }
  `,
})
export class StatTileComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly note = input('');
  readonly color = input('primary');
}
