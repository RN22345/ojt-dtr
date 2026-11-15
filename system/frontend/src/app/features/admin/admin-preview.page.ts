import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { STRINGS } from '../../shared/strings';
import { AdminDashboardPreviewComponent } from './admin-dashboard-preview.component';
import { AdminPreviewTableComponent, AdminTablePreview } from './admin-preview-table.component';
import { ADMIN_PREVIEW_STRINGS } from './admin-preview.strings';
import { ADMIN_TABLE_PREVIEWS } from './admin-table-previews';

type AdminPageKey = 'adminDashboard' | keyof typeof ADMIN_TABLE_PREVIEWS;

interface TablePage {
  description: string;
  actions: readonly { label: string; tone?: 'outline' }[];
  table: AdminTablePreview;
}

@Component({
  selector: 'app-admin-preview-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, PageHeaderComponent, AdminDashboardPreviewComponent, AdminPreviewTableComponent],
  template: `
    <app-page-header [title]="title()" />
    <ion-content>
      @let page = tablePage();
      <div class="preview-header">
        <div class="intro">
          <span class="mockup">{{ text.label }}</span>
          <p>{{ page?.description ?? text.dashboardDescription }}</p>
        </div>
        @if (page) {
          <div class="actions" role="group" [attr.aria-label]="text.unavailableActions">
            @for (action of page.actions; track action.label) {
              <button type="button" [class.outline]="action.tone === 'outline'" disabled>{{ action.label }}</button>
            }
          </div>
        }
      </div>
      @if (page) {
        <app-admin-preview-table [table]="page.table" [label]="title()" />
      } @else {
        <app-admin-dashboard-preview />
      }
    </ion-content>
  `,
  styles: `
    ion-content {
      --background: var(--lb-page);
      --padding-start: clamp(14px, 2vw, 24px);
      --padding-end: clamp(14px, 2vw, 24px);
      --padding-top: 20px;
      --padding-bottom: 24px;
    }
    ion-content::part(scroll) { max-width: none; }
    .preview-header, .intro, .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }
    .preview-header { justify-content: space-between; margin-bottom: 13px; }
    .intro { column-gap: 11px; flex: 1 1 330px; }
    .intro p { margin: 0; font-size: 0.75rem; color: var(--ion-color-medium-shade); }
    .mockup {
      padding: 2px 7px;
      border-radius: 4px;
      color: var(--ion-color-dark);
      background: var(--lb-admin-badge);
      font-size: 0.6875rem;
      font-weight: 650;
    }
    .actions button {
      min-height: 34px;
      min-width: 108px;
      padding: 6px 16px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: var(--lb-primary-gradient);
      color: var(--ion-color-primary-contrast);
      font-family: inherit;
      font-size: 0.8125rem;
      font-weight: 600;
      opacity: 0.88;
      cursor: default;
    }
    .actions .outline {
      background: var(--lb-danger-soft);
      border-color: var(--ion-color-danger);
      border-radius: 7px;
      color: var(--ion-color-danger);
    }
  `,
})
export class AdminPreviewPage {
  readonly pageKey = input.required<AdminPageKey>();
  protected readonly text = ADMIN_PREVIEW_STRINGS;
  protected readonly title = computed(() => STRINGS.pages[this.pageKey()]);
  protected readonly tablePage = computed<TablePage | null>(() => {
    const key = this.pageKey();
    return key === 'adminDashboard' ? null : ADMIN_TABLE_PREVIEWS[key];
  });
}
