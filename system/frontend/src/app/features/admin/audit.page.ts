// Admin audit log page (FR-AUD-02): filters by table, actor, and dates. 50 rows on each page. Read only.
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { IonButton, IonInput, IonSelect, IonSelectOption } from '@ionic/angular';
import { AUDIT_PAGE_SIZE, AdminApi } from '../../data/admin/admin-api.service';
import { AdminUser, AuditFilter, AuditPage } from '../../data/admin/admin-models';
import { STRINGS } from '../../shared/strings';
import { ADM_STRINGS } from '../../shared/strings-adm';
import { dateLabel, timeOfDay } from '../../shared/utils/format';
import { localDate } from '../../shared/utils/hours';
import { changedFields, errorMessage, pageCount } from './admin-forms';
import { AdminPageComponent } from './admin-page.component';

const NO_FILTER: AuditFilter = { entity: '', actorId: '', from: '', to: '' };

@Component({
  selector: 'app-admin-audit-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminPageComponent, IonButton, IonInput, IonSelect, IonSelectOption],
  template: `
    <app-admin-page [title]="pages.adminAudit" [error]="error()">
      <div class="adm-bar">
        <ion-select [label]="t.entity" labelPlacement="stacked" fill="outline" interface="popover" [value]="draft().entity"
          (ionChange)="patch({ entity: $any($event).detail.value ?? '' })" data-testid="entity">
          <ion-select-option value="">{{ s.all }}</ion-select-option>
          @for (e of entities; track e) {
            <ion-select-option [value]="e">{{ t.entities[e] }}</ion-select-option>
          }
        </ion-select>
        <ion-select [label]="t.actor" labelPlacement="stacked" fill="outline" interface="popover" [value]="draft().actorId"
          (ionChange)="patch({ actorId: $any($event).detail.value ?? '' })" data-testid="actor">
          <ion-select-option value="">{{ s.all }}</ion-select-option>
          @for (u of users(); track u.id) {
            <ion-select-option [value]="u.id">{{ u.fullName }}</ion-select-option>
          }
        </ion-select>
        <ion-input type="date" [label]="t.from" labelPlacement="stacked" fill="outline" [value]="draft().from"
          (ionInput)="patch({ from: $any($event).detail.value ?? '' })" data-testid="from" />
        <ion-input type="date" [label]="t.to" labelPlacement="stacked" fill="outline" [value]="draft().to"
          (ionInput)="patch({ to: $any($event).detail.value ?? '' })" data-testid="to" />
        <ion-button (click)="apply()" data-testid="apply">{{ t.apply }}</ion-button>
        <ion-button fill="outline" (click)="resetFilters()" data-testid="reset">{{ s.reset }}</ion-button>
      </div>

      <div class="adm-scroll">
        <table class="adm-table" data-testid="table">
          <thead>
            <tr>
              <th>{{ t.tableWhen }}</th>
              <th>{{ t.tableActor }}</th>
              <th>{{ t.tableAction }}</th>
              <th>{{ t.tableEntity }}</th>
              <th>{{ t.tableChanged }}</th>
            </tr>
          </thead>
          <tbody>
            @for (r of result().rows; track r.id) {
              <tr>
                <td>{{ when(r.createdAt) }}</td>
                <td>{{ actorName(r.actorId) }}</td>
                <td>{{ t.actions[r.action] ?? r.action }}</td>
                <td>{{ t.entities[r.entity] ?? r.entity }}</td>
                <td class="adm-muted">{{ fields(r) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (!loading() && result().rows.length === 0) {
        <p class="adm-muted">{{ s.empty }}</p>
      }

      <div class="adm-bar">
        <ion-button fill="outline" [disabled]="page() === 0 || loading()" (click)="go(page() - 1)" data-testid="previous">{{ t.previous }}</ion-button>
        <span class="adm-muted" data-testid="page-info">{{ t.pageOf(page() + 1, pageTotal(), result().total) }}</span>
        <ion-button fill="outline" [disabled]="page() + 1 >= pageTotal() || loading()" (click)="go(page() + 1)" data-testid="next">{{ t.next }}</ion-button>
      </div>
    </app-admin-page>
  `,
})
export class AdminAuditPage implements OnInit {
  private readonly api = inject(AdminApi);
  protected readonly pages = STRINGS.pages;
  protected readonly s = ADM_STRINGS;
  protected readonly t = ADM_STRINGS.audit;
  protected readonly entities = Object.keys(ADM_STRINGS.audit.entities);

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly result = signal<AuditPage>({ rows: [], total: 0 });
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  /** The values in the fields. They apply when the admin presses "Apply filters". */
  protected readonly draft = signal<AuditFilter>(NO_FILTER);
  private readonly applied = signal<AuditFilter>(NO_FILTER);
  protected readonly page = signal(0);
  protected readonly pageTotal = computed(() => pageCount(this.result().total, AUDIT_PAGE_SIZE));

  ngOnInit(): void {
    void this.api
      .listUsers()
      .then((list) => this.users.set(list))
      .catch(() => undefined);
    void this.go(0);
  }

  protected patch(change: Partial<AuditFilter>): void {
    this.draft.update((f) => ({ ...f, ...change }));
  }

  protected apply(): void {
    this.applied.set(this.draft());
    void this.go(0);
  }

  protected resetFilters(): void {
    this.draft.set(NO_FILTER);
    this.apply();
  }

  protected async go(page: number): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.result.set(await this.api.auditPage(this.applied(), page));
      this.page.set(page);
    } catch (e) {
      this.error.set(`${this.s.loadFailed} ${errorMessage(e)}`);
    } finally {
      this.loading.set(false);
    }
  }

  protected when(iso: string): string {
    return `${dateLabel(localDate(iso))} ${timeOfDay(iso)}`;
  }

  protected actorName(id: string | null): string {
    return id ? (this.users().find((u) => u.id === id)?.fullName ?? id.slice(0, 8)) : this.t.system;
  }

  protected fields(entry: Parameters<typeof changedFields>[0]): string {
    return changedFields(entry).join(', ');
  }
}
