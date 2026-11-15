import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type AdminPreviewTone = 'success' | 'danger' | 'warning';
export type AdminPreviewCell = string | { text: string; tone: AdminPreviewTone };

export interface AdminTablePreview {
  columns: readonly string[];
  rows: readonly (readonly AdminPreviewCell[])[];
}

@Component({
  selector: 'app-admin-preview-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-frame" tabindex="0" role="region" [attr.aria-label]="label()">
      <table [attr.aria-label]="label()">
        <thead>
          <tr>
            @for (column of table().columns; track $index) {
              <th scope="col">{{ column }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of table().rows; track $index) {
            <tr>
              @for (cell of row; track $index) {
                <td>
                  @if (isBadge(cell)) {
                    <span class="badge" [attr.data-tone]="cell.tone">{{ cell.text }}</span>
                  } @else {
                    {{ cell }}
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host { display: block; }
    .table-frame {
      overflow-x: auto;
      background: var(--lb-panel);
      border: 1px solid var(--lb-panel-border);
      border-radius: 7px;
    }
    .table-frame:focus-visible { outline: 2px solid var(--ion-color-primary); outline-offset: 2px; }
    table { width: 100%; border-collapse: collapse; text-align: start; font-size: 0.75rem; }
    th, td { padding: 9px 13px; text-align: start; }
    th { background: var(--lb-admin-muted); color: var(--ion-color-medium-shade); font-weight: 650; }
    tbody tr + tr { border-top: 1px solid var(--lb-panel-border); }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 0.625rem;
      font-weight: 650;
      line-height: 1.2;
    }
    [data-tone='success'] { background: var(--lb-admin-success); color: var(--ion-color-dark); }
    [data-tone='warning'] { background: var(--ion-color-secondary); color: var(--ion-color-dark); }
    [data-tone='danger'] { background: var(--ion-color-danger); color: var(--ion-color-danger-contrast); }
    @media (max-width: 600px) { table { min-width: 540px; } }
  `,
})
export class AdminPreviewTableComponent {
  readonly table = input.required<AdminTablePreview>();
  readonly label = input.required<string>();

  protected isBadge(cell: AdminPreviewCell): cell is Exclude<AdminPreviewCell, string> {
    return typeof cell !== 'string';
  }
}
