// Status badge (mood board): one color and one text for each report or correction status.
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonBadge } from '@ionic/angular';
import { UI_STRINGS } from '../strings-ui';

const COLORS: Record<string, string> = {
  draft: 'medium',
  submitted: 'warning',
  pending: 'warning',
  approved: 'success',
  returned: 'danger',
  rejected: 'danger',
  none: 'light',
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonBadge],
  template: `<ion-badge [color]="color()">{{ text() }}</ion-badge>`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
    }
    ion-badge {
      padding: 6px 10px;
      min-width: var(--lb-badge-min-width, auto);
      border-radius: var(--lb-badge-radius, 5px);
      text-align: center;
      font-size: 0.625rem;
      font-weight: 600;
      line-height: 1.25;
      white-space: normal;
    }
    ion-badge[color='medium'] {
      --ion-color-base: var(--ion-color-primary-contrast);
      --ion-color-contrast: var(--ion-color-dark);
    }
    ion-badge[color='warning'] {
      --ion-color-base: var(--ion-color-secondary);
      --ion-color-contrast: var(--ion-color-secondary-contrast);
    }
    ion-badge[color='light'] {
      --ion-color-base: var(--ion-color-light);
      --ion-color-contrast: var(--ion-color-medium-shade);
    }
  `,
})
export class StatusBadgeComponent {
  /** draft, submitted, approved, returned, pending, rejected, or none. */
  readonly status = input.required<string>();
  protected readonly color = computed(() => COLORS[this.status()] ?? 'medium');
  protected readonly text = computed(() => UI_STRINGS.status[this.status() as keyof typeof UI_STRINGS.status] ?? this.status());
}
