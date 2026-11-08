// Admin host companies page (FR-ADM-02, FR-ADM-06): list, create, change, photo and location settings.
// The form values stay when the app is offline or a save fails (TC-ST-ADM-02).
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { IonButton, IonCheckbox, IonInput, IonNote } from '@ionic/angular';
import { AdminApi } from '../../data/admin/admin-api.service';
import { Company } from '../../data/admin/admin-models';
import { STRINGS } from '../../shared/strings';
import { ADM_STRINGS } from '../../shared/strings-adm';
import { CompanyForm, EMPTY_COMPANY, errorMessage, hasErrors, validateCompany } from './admin-forms';
import { AdminOnline } from './admin-online.service';
import { AdminPageComponent } from './admin-page.component';

@Component({
  selector: 'app-admin-companies-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminPageComponent, IonButton, IonCheckbox, IonInput, IonNote],
  template: `
    <app-admin-page [title]="pages.adminCompanies" [error]="error()" [notice]="notice()">
      <div class="adm-bar">
        <ion-button (click)="open(null)" data-testid="new">{{ t.create }}</ion-button>
      </div>

      @if (editing()) {
        <form class="adm-form" (submit)="$event.preventDefault(); save()" novalidate data-testid="form">
          <h2>{{ editingId() ? t.editTitle : t.createTitle }}</h2>
          <div>
            <ion-input [label]="t.name" labelPlacement="stacked" fill="outline" [value]="form().name"
              (ionInput)="patch({ name: $any($event).detail.value ?? '' })" data-testid="name" />
            @if (shown().name; as m) {
              <ion-note color="danger">{{ m }}</ion-note>
            }
          </div>
          <div>
            <ion-input [label]="t.address" labelPlacement="stacked" fill="outline" [value]="form().address"
              (ionInput)="patch({ address: $any($event).detail.value ?? '' })" data-testid="address" />
            @if (shown().address; as m) {
              <ion-note color="danger">{{ m }}</ion-note>
            }
          </div>
          <div class="adm-wide">
            <ion-checkbox [checked]="form().photoRequired"
              (ionChange)="patch({ photoRequired: $any($event).detail.checked })" data-testid="photo">{{ t.photoRequired }}</ion-checkbox>
          </div>
          <div class="adm-wide">
            <ion-checkbox [checked]="form().locationRequired"
              (ionChange)="patch({ locationRequired: $any($event).detail.checked })" data-testid="location">{{ t.locationRequired }}</ion-checkbox>
          </div>
          <div class="adm-actions adm-wide">
            <ion-button type="submit" [disabled]="!canSave()" data-testid="save">{{ busy() ? s.saving : s.save }}</ion-button>
            <ion-button fill="outline" (click)="editing.set(false)">{{ s.cancel }}</ion-button>
          </div>
        </form>
      }

      <div class="adm-scroll">
        <table class="adm-table" data-testid="table">
          <thead>
            <tr>
              <th>{{ t.tableName }}</th>
              <th>{{ t.tableAddress }}</th>
              <th>{{ t.tablePhoto }}</th>
              <th>{{ t.tableLocation }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (c of companies(); track c.id) {
              <tr>
                <td>{{ c.name }}</td>
                <td>{{ c.address || '-' }}</td>
                <td>{{ c.photoRequired ? t.yes : t.no }}</td>
                <td>{{ c.locationRequired ? t.yes : t.no }}</td>
                <td><ion-button size="small" fill="outline" (click)="open(c)">{{ s.edit }}</ion-button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (!loading() && companies().length === 0) {
        <p class="adm-muted">{{ s.empty }}</p>
      }
    </app-admin-page>
  `,
})
export class AdminCompaniesPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly online = inject(AdminOnline);
  protected readonly pages = STRINGS.pages;
  protected readonly s = ADM_STRINGS;
  protected readonly t = ADM_STRINGS.companies;

  protected readonly companies = signal<Company[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly editing = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly form = signal<CompanyForm>(EMPTY_COMPANY);
  protected readonly submitted = signal(false);

  private readonly errors = computed(() => validateCompany(this.form()));
  protected readonly shown = computed(() => (this.submitted() ? this.errors() : {}) as ReturnType<typeof validateCompany>);
  /** The save button is off when the app is offline (TC-ST-ADM-02) or a save runs. */
  protected readonly canSave = computed(() => this.online.online() && !this.busy());

  ngOnInit(): void {
    void this.load();
  }

  protected patch(change: Partial<CompanyForm>): void {
    this.form.update((f) => ({ ...f, ...change }));
  }

  protected open(company: Company | null): void {
    this.editing.set(true);
    this.editingId.set(company?.id ?? null);
    this.submitted.set(false);
    this.error.set('');
    this.notice.set('');
    this.form.set(
      company
        ? {
            name: company.name,
            address: company.address,
            photoRequired: company.photoRequired,
            locationRequired: company.locationRequired,
          }
        : EMPTY_COMPANY,
    );
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.companies.set(await this.api.listCompanies());
    } catch (e) {
      this.error.set(`${this.s.loadFailed} ${errorMessage(e)}`);
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    if (!this.canSave() || hasErrors(this.errors())) {
      return;
    }
    const f = this.form();
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await this.api.saveCompany(this.editingId(), { ...f, name: f.name.trim(), address: f.address.trim() });
      this.notice.set(this.s.saved);
      this.editing.set(false);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
