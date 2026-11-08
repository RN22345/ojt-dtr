// Admin batches page (FR-ADM-03): list, create, change. Name, start date, end date, and required hours.
// The form values stay when the app is offline or a save fails (TC-ST-ADM-02).
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { IonButton, IonInput, IonNote } from '@ionic/angular';
import { AdminApi } from '../../data/admin/admin-api.service';
import { Batch } from '../../data/admin/admin-models';
import { STRINGS } from '../../shared/strings';
import { ADM_STRINGS } from '../../shared/strings-adm';
import { dateLabel } from '../../shared/utils/format';
import { BatchForm, EMPTY_BATCH, errorMessage, hasErrors, validateBatch } from './admin-forms';
import { AdminOnline } from './admin-online.service';
import { AdminPageComponent } from './admin-page.component';

@Component({
  selector: 'app-admin-batches-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminPageComponent, IonButton, IonInput, IonNote],
  template: `
    <app-admin-page [title]="pages.adminBatches" [error]="error()" [notice]="notice()">
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
            <ion-input type="date" [label]="t.startDate" labelPlacement="stacked" fill="outline" [value]="form().startDate"
              (ionInput)="patch({ startDate: $any($event).detail.value ?? '' })" data-testid="start-date" />
            @if (shown().startDate; as m) {
              <ion-note color="danger">{{ m }}</ion-note>
            }
          </div>
          <div>
            <ion-input type="date" [label]="t.endDate" labelPlacement="stacked" fill="outline" [value]="form().endDate"
              (ionInput)="patch({ endDate: $any($event).detail.value ?? '' })" data-testid="end-date" />
            @if (shown().endDate; as m) {
              <ion-note color="danger">{{ m }}</ion-note>
            }
          </div>
          <div>
            <ion-input type="number" inputmode="numeric" [label]="t.requiredHours" labelPlacement="stacked" fill="outline"
              [value]="form().requiredHours" (ionInput)="patch({ requiredHours: '' + ($any($event).detail.value ?? '') })" data-testid="hours" />
            @if (shown().requiredHours; as m) {
              <ion-note color="danger">{{ m }}</ion-note>
            }
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
              <th>{{ t.tablePeriod }}</th>
              <th class="adm-num">{{ t.tableHours }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (b of batches(); track b.id) {
              <tr>
                <td>{{ b.name }}</td>
                <td>{{ label(b.startDate) }} - {{ label(b.endDate) }}</td>
                <td class="adm-num">{{ b.requiredHours }}</td>
                <td><ion-button size="small" fill="outline" (click)="open(b)">{{ s.edit }}</ion-button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (!loading() && batches().length === 0) {
        <p class="adm-muted">{{ s.empty }}</p>
      }
    </app-admin-page>
  `,
})
export class AdminBatchesPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly online = inject(AdminOnline);
  protected readonly pages = STRINGS.pages;
  protected readonly s = ADM_STRINGS;
  protected readonly t = ADM_STRINGS.batches;
  protected readonly label = dateLabel;

  protected readonly batches = signal<Batch[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly editing = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly form = signal<BatchForm>(EMPTY_BATCH);
  protected readonly submitted = signal(false);

  private readonly errors = computed(() => validateBatch(this.form()));
  protected readonly shown = computed(() => (this.submitted() ? this.errors() : {}) as ReturnType<typeof validateBatch>);
  /** The save button is off when the app is offline (TC-ST-ADM-02) or a save runs. */
  protected readonly canSave = computed(() => this.online.online() && !this.busy());

  ngOnInit(): void {
    void this.load();
  }

  protected patch(change: Partial<BatchForm>): void {
    this.form.update((f) => ({ ...f, ...change }));
  }

  protected open(batch: Batch | null): void {
    this.editing.set(true);
    this.editingId.set(batch?.id ?? null);
    this.submitted.set(false);
    this.error.set('');
    this.notice.set('');
    this.form.set(
      batch
        ? { name: batch.name, startDate: batch.startDate, endDate: batch.endDate, requiredHours: String(batch.requiredHours) }
        : EMPTY_BATCH,
    );
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.batches.set(await this.api.listBatches());
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
      await this.api.saveBatch(this.editingId(), {
        name: f.name.trim(),
        startDate: f.startDate,
        endDate: f.endDate,
        requiredHours: Number(f.requiredHours),
      });
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
