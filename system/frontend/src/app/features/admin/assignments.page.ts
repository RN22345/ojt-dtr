// Admin assignments page (FR-ADM-04): assign an OJT to a host company, a facilitator, and a batch; move; deactivate.
// An OJT has one active assignment (unique index). A move makes the old assignment not active, then adds the new one.
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { IonBadge, IonButton, IonCheckbox, IonNote, IonSelect, IonSelectOption } from '@ionic/angular';
import { AdminApi } from '../../data/admin/admin-api.service';
import { AdminUser, Assignment, Batch, Company } from '../../data/admin/admin-models';
import { STRINGS } from '../../shared/strings';
import { ADM_STRINGS } from '../../shared/strings-adm';
import {
  AssignmentForm,
  EMPTY_ASSIGNMENT,
  activeAssignmentOf,
  errorMessage,
  hasErrors,
  validateAssignment,
} from './admin-forms';
import { AdminOnline } from './admin-online.service';
import { AdminPageComponent } from './admin-page.component';

@Component({
  selector: 'app-admin-assignments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminPageComponent, IonBadge, IonButton, IonCheckbox, IonNote, IonSelect, IonSelectOption],
  template: `
    <app-admin-page [title]="pages.adminAssignments" [error]="error()" [notice]="notice()">
      <form class="adm-form" (submit)="$event.preventDefault(); save()" novalidate data-testid="form">
        <h2>{{ current() ? t.moveTitle : t.title }}</h2>
        <div>
          <ion-select [label]="t.ojt" labelPlacement="stacked" fill="outline" interface="popover" [value]="form().ojtId"
            (ionChange)="patch({ ojtId: $any($event).detail.value ?? '' })" data-testid="ojt">
            @for (u of ojts(); track u.id) {
              <ion-select-option [value]="u.id">{{ u.fullName }}</ion-select-option>
            }
          </ion-select>
          @if (shown().ojtId; as m) {
            <ion-note color="danger">{{ m }}</ion-note>
          }
        </div>
        <div>
          <ion-select [label]="t.facilitator" labelPlacement="stacked" fill="outline" interface="popover" [value]="form().facilitatorId"
            (ionChange)="patch({ facilitatorId: $any($event).detail.value ?? '' })" data-testid="facilitator">
            @for (u of facilitators(); track u.id) {
              <ion-select-option [value]="u.id">{{ u.fullName }}</ion-select-option>
            }
          </ion-select>
          @if (shown().facilitatorId; as m) {
            <ion-note color="danger">{{ m }}</ion-note>
          }
        </div>
        <div>
          <ion-select [label]="t.company" labelPlacement="stacked" fill="outline" interface="popover" [value]="form().companyId"
            (ionChange)="patch({ companyId: $any($event).detail.value ?? '' })" data-testid="company">
            @for (c of companies(); track c.id) {
              <ion-select-option [value]="c.id">{{ c.name }}</ion-select-option>
            }
          </ion-select>
          @if (shown().companyId; as m) {
            <ion-note color="danger">{{ m }}</ion-note>
          }
        </div>
        <div>
          <ion-select [label]="t.batch" labelPlacement="stacked" fill="outline" interface="popover" [value]="form().batchId"
            (ionChange)="patch({ batchId: $any($event).detail.value ?? '' })" data-testid="batch">
            @for (b of batches(); track b.id) {
              <ion-select-option [value]="b.id">{{ b.name }}</ion-select-option>
            }
          </ion-select>
          @if (shown().batchId; as m) {
            <ion-note color="danger">{{ m }}</ion-note>
          }
        </div>
        @if (current()) {
          <p class="adm-muted adm-wide">{{ t.moveNote }}</p>
        }
        <div class="adm-actions adm-wide">
          <ion-button type="submit" [disabled]="!canSave()" data-testid="save">
            {{ busy() ? s.saving : current() ? t.move : t.assign }}
          </ion-button>
        </div>
      </form>

      <ion-checkbox [checked]="showInactive()" (ionChange)="showInactive.set($any($event).detail.checked)">{{ t.showInactive }}</ion-checkbox>

      <div class="adm-scroll">
        <table class="adm-table" data-testid="table">
          <thead>
            <tr>
              <th>{{ t.tableOjt }}</th>
              <th>{{ t.tableFacilitator }}</th>
              <th>{{ t.tableCompany }}</th>
              <th>{{ t.tableBatch }}</th>
              <th>{{ t.tableState }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (a of visible(); track a.id) {
              <tr>
                <td>{{ userName(a.ojtId) }}</td>
                <td>{{ userName(a.facilitatorId) }}</td>
                <td>{{ companyName(a.companyId) }}</td>
                <td>{{ batchName(a.batchId) }}</td>
                <td>
                  <ion-badge [color]="a.active ? 'success' : 'medium'">{{ a.active ? s.statusActive : s.statusInactive }}</ion-badge>
                </td>
                <td>
                  @if (a.active) {
                    <ion-button size="small" fill="outline" color="danger" [disabled]="!canSave()" (click)="deactivate(a)">
                      {{ t.deactivate }}
                    </ion-button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (!loading() && visible().length === 0) {
        <p class="adm-muted">{{ s.empty }}</p>
      }
    </app-admin-page>
  `,
})
export class AdminAssignmentsPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly online = inject(AdminOnline);
  protected readonly pages = STRINGS.pages;
  protected readonly s = ADM_STRINGS;
  protected readonly t = ADM_STRINGS.assignments;

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly companies = signal<Company[]>([]);
  protected readonly batches = signal<Batch[]>([]);
  protected readonly assignments = signal<Assignment[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly form = signal<AssignmentForm>(EMPTY_ASSIGNMENT);
  protected readonly submitted = signal(false);
  protected readonly showInactive = signal(false);

  protected readonly ojts = computed(() => this.users().filter((u) => u.role === 'ojt' && u.status === 'active'));
  protected readonly facilitators = computed(() =>
    this.users().filter((u) => u.role === 'facilitator' && u.status === 'active'),
  );
  protected readonly visible = computed(() => this.assignments().filter((a) => a.active || this.showInactive()));
  /** The active assignment of the selected OJT. If there is one, the save is a move. */
  protected readonly current = computed(() => activeAssignmentOf(this.assignments(), this.form().ojtId));
  private readonly errors = computed(() => validateAssignment(this.form()));
  protected readonly shown = computed(() => (this.submitted() ? this.errors() : {}) as ReturnType<typeof validateAssignment>);
  /** Save buttons are off when the app is offline (TC-ST-ADM-02) or a save runs. */
  protected readonly canSave = computed(() => this.online.online() && !this.busy());

  ngOnInit(): void {
    void this.load();
  }

  protected patch(change: Partial<AssignmentForm>): void {
    this.form.update((f) => ({ ...f, ...change }));
  }

  protected userName(id: string): string {
    return this.users().find((u) => u.id === id)?.fullName ?? this.t.unknown;
  }

  protected companyName(id: string): string {
    return this.companies().find((c) => c.id === id)?.name ?? this.t.unknown;
  }

  protected batchName(id: string): string {
    return this.batches().find((b) => b.id === id)?.name ?? this.t.unknown;
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [users, companies, batches, assignments] = await Promise.all([
        this.api.listUsers(),
        this.api.listCompanies(),
        this.api.listBatches(),
        this.api.listAssignments(),
      ]);
      this.users.set(users);
      this.companies.set(companies);
      this.batches.set(batches);
      this.assignments.set(assignments);
    } catch (e) {
      this.error.set(`${this.s.loadFailed} ${errorMessage(e)}`);
    } finally {
      this.loading.set(false);
    }
  }

  /** Runs one server action. On failure the form values stay. */
  private async run(action: () => Promise<void>): Promise<boolean> {
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await action();
      this.notice.set(this.s.saved);
      await this.load();
      return true;
    } catch (e) {
      this.error.set(errorMessage(e));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    if (!this.canSave() || hasErrors(this.errors())) {
      return;
    }
    const f = this.form();
    if (await this.run(() => this.api.assign(f, this.current()?.id ?? null))) {
      this.form.set(EMPTY_ASSIGNMENT);
      this.submitted.set(false);
    }
  }

  protected async deactivate(assignment: Assignment): Promise<void> {
    if (this.canSave()) {
      await this.run(() => this.api.setAssignmentActive(assignment.id, false));
    }
  }
}
