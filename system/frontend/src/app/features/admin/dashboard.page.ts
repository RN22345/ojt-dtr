// Admin dashboard (FR-MON-03, FR-MON-04, FR-EXP-03): counts, late reports, OJTs behind schedule, a table,
// filters, and the two CSV exports of the selected batch.
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { IonBadge, IonButton, IonSelect, IonSelectOption } from '@ionic/angular';
import { AdminApi } from '../../data/admin/admin-api.service';
import { DashboardRow } from '../../data/admin/admin-models';
import { STRINGS } from '../../shared/strings';
import { ADM_STRINGS } from '../../shared/strings-adm';
import { CSV_MIME, csvFileName, dtrSummaryCsv, reportSummaryCsv } from '../../shared/utils/csv';
import { StatTileComponent } from '../../shared/ui/stat-tile.component';
import { AdminOnline } from './admin-online.service';
import { errorMessage } from './admin-forms';
import { AdminPageComponent } from './admin-page.component';
import { DashboardFilter, NO_FILTER, countBy, filterOptions, filterRows, isFiltered, totals } from './dashboard-logic';

@Component({
  selector: 'app-admin-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminPageComponent, StatTileComponent, IonButton, IonSelect, IonSelectOption, IonBadge],
  template: `
    <app-admin-page [title]="pages.adminDashboard" [error]="error()">
      <div class="adm-bar">
        <ion-select [label]="t.filterBatch" labelPlacement="stacked" fill="outline" interface="popover"
          [value]="filter().batchId" (ionChange)="patch({ batchId: $any($event).detail.value ?? '' })" data-testid="filter-batch">
          <ion-select-option value="">{{ s.all }}</ion-select-option>
          @for (o of options().batches; track o.id) {
            <ion-select-option [value]="o.id">{{ o.name }}</ion-select-option>
          }
        </ion-select>
        <ion-select [label]="t.filterCompany" labelPlacement="stacked" fill="outline" interface="popover"
          [value]="filter().companyId" (ionChange)="patch({ companyId: $any($event).detail.value ?? '' })" data-testid="filter-company">
          <ion-select-option value="">{{ s.all }}</ion-select-option>
          @for (o of options().companies; track o.id) {
            <ion-select-option [value]="o.id">{{ o.name }}</ion-select-option>
          }
        </ion-select>
        <ion-select [label]="t.filterFacilitator" labelPlacement="stacked" fill="outline" interface="popover"
          [value]="filter().facilitatorId" (ionChange)="patch({ facilitatorId: $any($event).detail.value ?? '' })" data-testid="filter-facilitator">
          <ion-select-option value="">{{ s.all }}</ion-select-option>
          @for (o of options().facilitators; track o.id) {
            <ion-select-option [value]="o.id">{{ o.name }}</ion-select-option>
          }
        </ion-select>
        <ion-button fill="outline" [disabled]="!filtered()" (click)="filter.set(none)" data-testid="reset">{{ s.reset }}</ion-button>
        <ion-button fill="clear" [disabled]="loading()" (click)="load()">{{ s.refresh }}</ion-button>
        <ion-button fill="outline" [disabled]="!canExport()" (click)="exportDtr()" data-testid="export-dtr">{{ t.exportDtr }}</ion-button>
        <ion-button fill="outline" [disabled]="!canExport()" (click)="exportReports()" data-testid="export-reports">{{ t.exportReports }}</ion-button>
      </div>

      <div class="adm-tiles adm-summary">
        <app-stat-tile [label]="t.tilesTotal" [value]="sum().ojts" color="primary" />
        <app-stat-tile [label]="t.tilesLate" [value]="sum().lateReports" color="warning" />
        <app-stat-tile [label]="t.tilesBehind" [value]="sum().behind" color="danger" />
      </div>

      <h2 class="adm-sub">{{ t.byBatch }}</h2>
      <div class="adm-tiles">
        @for (c of batchCounts(); track c.id) {
          <app-stat-tile [label]="c.name" [value]="c.count" color="secondary" />
        }
      </div>
      <h2 class="adm-sub">{{ t.byCompany }}</h2>
      <div class="adm-tiles">
        @for (c of companyCounts(); track c.id) {
          <app-stat-tile [label]="c.name" [value]="c.count" color="tertiary" />
        }
      </div>

      <div class="adm-scroll" tabindex="0">
        <table class="adm-table" data-testid="table">
          <thead>
            <tr>
              <th>{{ t.tableOjt }}</th>
              <th>{{ t.tableCompany }}</th>
              <th>{{ t.tableBatch }}</th>
              <th>{{ t.tableFacilitator }}</th>
              <th class="adm-num">{{ t.tableHours }}</th>
              <th class="adm-num">{{ t.tableLate }}</th>
              <th>{{ t.tableState }}</th>
            </tr>
          </thead>
          <tbody>
            @for (r of visible(); track r.ojtId) {
              <tr>
                <td>{{ r.ojtName }}</td>
                <td>{{ r.companyName }}</td>
                <td>{{ r.batchName }}</td>
                <td>{{ r.facilitatorName }}</td>
                <td class="adm-num">{{ t.hoursOf(r.loggedMinutes, r.requiredHours) }}</td>
                <td class="adm-num">{{ r.lateReports }}</td>
                <td>
                  <ion-badge [color]="r.behind ? 'danger' : 'success'">{{ r.behind ? t.behind : t.onTrack }}</ion-badge>
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
export class AdminDashboardPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly online = inject(AdminOnline);
  protected readonly pages = STRINGS.pages;
  protected readonly s = ADM_STRINGS;
  protected readonly t = ADM_STRINGS.dashboard;
  protected readonly none = NO_FILTER;

  protected readonly rows = signal<DashboardRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly error = signal('');
  protected readonly filter = signal<DashboardFilter>(NO_FILTER);

  protected readonly options = computed(() => filterOptions(this.rows()));
  protected readonly visible = computed(() => filterRows(this.rows(), this.filter()));
  protected readonly sum = computed(() => totals(this.visible()));
  protected readonly batchCounts = computed(() => countBy(this.visible(), 'batch'));
  protected readonly companyCounts = computed(() => countBy(this.visible(), 'company'));
  protected readonly filtered = computed(() => isFiltered(this.filter()));
  /** The batch of the filter. The exports need one batch. */
  protected readonly selectedBatch = computed(
    () => this.options().batches.find((b) => b.id === this.filter().batchId) ?? null,
  );
  /** The export buttons are off when no batch is selected or the app is offline (FR-EXP-03). */
  protected readonly canExport = computed(() => !!this.selectedBatch() && this.online.online() && !this.exporting());

  ngOnInit(): void {
    void this.load();
  }

  protected patch(change: Partial<DashboardFilter>): void {
    this.filter.update((f) => ({ ...f, ...change }));
  }

  /** Writes the DTR summary of the selected batch. It uses the rows of that batch, not the other filters. */
  protected exportDtr(): void {
    const batch = this.selectedBatch();
    if (!batch) {
      return;
    }
    const rows = this.rows()
      .filter((r) => r.batchId === batch.id)
      .map((r) => ({
        ojtName: r.ojtName,
        companyName: r.companyName,
        facilitatorName: r.facilitatorName,
        batchName: r.batchName,
        requiredHours: r.requiredHours,
        loggedMinutes: r.loggedMinutes,
        lateReports: r.lateReports,
        behind: r.behind,
      }));
    this.download(dtrSummaryCsv(rows), csvFileName('dtr', batch.name));
  }

  /** Writes the report summary of the selected batch. The server gives the rows. */
  protected async exportReports(): Promise<void> {
    const batch = this.selectedBatch();
    if (!batch) {
      return;
    }
    this.exporting.set(true);
    this.error.set('');
    try {
      const list = await this.api.reportSummary(batch.id);
      this.download(reportSummaryCsv(list), csvFileName('reports', batch.name));
    } catch (e) {
      this.error.set(`${this.t.exportFailed} ${errorMessage(e)}`);
    } finally {
      this.exporting.set(false);
    }
  }

  /** Starts the download of the text as a CSV file. */
  private download(text: string, name: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: CSV_MIME }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.rows.set(await this.api.dashboard());
    } catch (e) {
      this.error.set(`${this.s.loadFailed} ${errorMessage(e)}`);
    } finally {
      this.loading.set(false);
    }
  }
}
