// OJT DTR export: choose a date range, see the time of each day, and make a PDF file (FR-EXP-01).
// The page operates offline: the sessions come from the local database.
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AlertController, IonButton, IonChip, IonContent, IonInput, IonLabel, ToastController } from '@ionic/angular';
import { PunchRepository } from '../../data/repositories/punch.repository';
import { addDays } from '../../data/store/store-models';
import { WorkStore } from '../../data/store/work-store.service';
import { FILE_SHARE } from '../../plugins/file-share.plugin';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { OJT_STRINGS } from '../../shared/strings-ojt';
import { UI_STRINGS } from '../../shared/strings-ui';
import { dateLabel } from '../../shared/utils/format';
import { WorkSession, buildSessions, localDate, weekStart } from '../../shared/utils/hours';
import { buildDtrPdf, dtrPdfDays, pdfFileName } from '../../shared/utils/pdf-export';

type Chip = 'week' | 'lastWeek' | 'month' | 'all';

@Component({
  selector: 'app-export-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IonContent, IonInput, IonChip, IonLabel, IonButton],
  template: `
    <app-page-header [title]="text.title" backHref="/ojt/home" />
    <ion-content class="ion-padding">
      <h3>{{ text.range }}</h3>
      <div class="chips">
        @for (chip of chips; track chip.key) {
          <ion-chip outline (click)="choose(chip.key)">
            <ion-label>{{ chip.label }}</ion-label>
          </ion-chip>
        }
      </div>

      <div class="dates">
        <ion-input
          type="date"
          fill="outline"
          labelPlacement="stacked"
          [label]="text.from"
          [value]="from()"
          [max]="today"
          (ionInput)="from.set(valueOf($event))"
        />
        <ion-input
          type="date"
          fill="outline"
          labelPlacement="stacked"
          [label]="text.to"
          [value]="to()"
          [max]="today"
          (ionInput)="to.set(valueOf($event))"
        />
      </div>
      @if (!rangeValid()) {
        <p class="error">{{ text.invalidRange }}</p>
      }

      <h3>{{ text.preview }}</h3>
      @if (rangeValid() && rows().length === 0) {
        <p class="empty">{{ text.empty }}</p>
      }
      @if (rows().length > 0) {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ text.day }}</th>
                <th>{{ text.timeIn }}</th>
                <th>{{ text.timeOut }}</th>
                <th class="num">{{ text.hours }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.date) {
                <tr>
                  <td>{{ dateLabel(row.date) }}</td>
                  <td>{{ row.firstIn ?? '-' }}</td>
                  <td>{{ row.lastOut ?? '-' }}</td>
                  <td class="num">{{ ui.hours(row.minutes) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="total">
          <strong>{{ text.total(ui.hours(totalMinutes())) }}</strong>
          <span> - {{ text.days(rows().length) }}</span>
        </p>
        <p class="total">{{ text.daysWithHours(daysWithHours()) }}</p>
      }

      <ion-button expand="block" [disabled]="!canExport()" (click)="confirmExport()">{{ text.exportPdf }}</ion-button>
    </ion-content>
  `,
  styles: `
    h3 {
      margin: 16px 0 6px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
    }
    .dates {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 8px;
    }
    .error {
      color: var(--ion-color-danger);
    }
    .empty {
      color: var(--ion-color-medium-shade);
    }
    .table-wrap {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
      white-space: nowrap;
    }
    th,
    td {
      padding: 6px 4px;
      text-align: left;
      border-bottom: 1px solid var(--ion-color-light-shade);
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .total {
      margin: 4px 0;
      text-align: right;
    }
    ion-button {
      margin-top: 12px;
    }
  `,
})
export class ExportPage {
  protected readonly text = OJT_STRINGS.export;
  protected readonly ui = UI_STRINGS;
  protected readonly dateLabel = dateLabel;
  protected readonly today = localDate(new Date());
  protected readonly chips: { key: Chip; label: string }[] = [
    { key: 'week', label: this.text.chipWeek },
    { key: 'lastWeek', label: this.text.chipLastWeek },
    { key: 'month', label: this.text.chipMonth },
    { key: 'all', label: this.text.chipAll },
  ];

  protected readonly from = signal(`${this.today.slice(0, 8)}01`);
  protected readonly to = signal(this.today);

  private readonly store = inject(WorkStore);
  private readonly punches = inject(PunchRepository);
  private readonly files = inject(FILE_SHARE);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  /** The work sessions of the OJT from the local database. */
  private readonly sessions = signal<WorkSession[]>([]);

  protected readonly rangeValid = computed(() => !!this.from() && !!this.to() && this.from() <= this.to());

  protected readonly rows = computed(() => dtrPdfDays(this.sessions(), this.from(), this.to()));

  protected readonly totalMinutes = computed(() => this.rows().reduce((sum, r) => sum + r.minutes, 0));
  protected readonly daysWithHours = computed(() => this.rows().filter((r) => r.minutes > 0).length);
  protected readonly canExport = computed(() => this.rangeValid() && this.daysWithHours() > 0);

  constructor() {
    void this.loadSessions();
  }

  protected valueOf(event: Event): string {
    return String((event as CustomEvent).detail.value ?? '');
  }

  protected choose(chip: Chip): void {
    const monday = weekStart(new Date());
    const ranges: Record<Chip, [string, string]> = {
      week: [monday, this.today],
      lastWeek: [addDays(monday, -7), addDays(monday, -1)],
      month: [`${this.today.slice(0, 8)}01`, this.today],
      all: [this.store.me().startDate, this.today],
    };
    const [from, to] = ranges[chip];
    this.from.set(from);
    this.to.set(to);
  }

  protected async confirmExport(): Promise<void> {
    const alert = await this.alerts.create({
      header: this.text.exportPdf,
      message: this.text.confirmMessage(this.from(), this.to()),
      buttons: [
        { text: this.text.cancel, role: 'cancel' },
        { text: this.text.exportPdf, role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') {
      await this.exportPdf();
    }
  }

  private async loadSessions(): Promise<void> {
    try {
      const list = await this.punches.listByOjt(this.store.meId());
      this.sessions.set(
        buildSessions(list.map((p) => ({ id: p.id, type: p.type, time: p.deviceTime, correctsPunchId: p.correctsPunchId }))),
      );
    } catch {
      // The local database is not available (for example, the web build). The page shows no rows.
      this.sessions.set([]);
    }
  }

  private async exportPdf(): Promise<void> {
    try {
      const me = this.store.me();
      const pdf = buildDtrPdf({
        fullName: me.fullName,
        companyName: me.companyName,
        from: this.from(),
        to: this.to(),
        days: this.rows(),
      });
      await this.files.sharePdf(pdfFileName('dtr', this.from(), this.to()), pdf, this.text.exportPdf);
      await this.toast(this.text.exported, 'success');
    } catch {
      await this.toast(this.text.exportFailed, 'danger');
    }
  }

  private async toast(message: string, color: string): Promise<void> {
    const toast = await this.toasts.create({ message, duration: 2500, color });
    await toast.present();
  }
}
