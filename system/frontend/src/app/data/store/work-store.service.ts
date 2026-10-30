// Work store (S3): the data of the OJT and facilitator screens, made from the repositories (local database).
// It replaces the UI prototype store (D-63). Reads are signals, so the pages update after each local change and
// after each sync (`SyncService.revision`). Each action writes through a repository to the local database and
// the outbox (FR-SYNC-01), then asks for a sync. All screens operate offline (AGENTS.md, rule 10).
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { DeviceRepository } from '../repositories/device.repository';
import { AssignmentRepository, OjtDetails } from '../repositories/assignment.repository';
import { AttachmentRepository, LocalPhoto } from '../repositories/attachment.repository';
import { CorrectionRepository, CorrectionRequest as CorrectionRecord } from '../repositories/correction.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { Punch, PunchRepository } from '../repositories/punch.repository';
import { ReportEvent, ReportRepository, WeeklyReport as ReportRecord } from '../repositories/report.repository';
import { SyncService } from '../sync/sync.service';
import { PunchInput, buildSessions, localDate, minutesByDate, weekStart } from '../../shared/utils/hours';
import { canEditReport } from '../../shared/utils/report-rules';
import { timeOfDay } from '../../shared/utils/format';
import { newId } from '../../shared/utils/uuid';
import {
  AppNotification,
  CorrectionKind,
  CorrectionRequest,
  DayMinutes,
  EMPTY_OJT,
  HoursProgress,
  MAX_REPORT_PHOTOS,
  OjtView,
  ReportActionResult,
  ReportContent,
  ReportHistoryEntry,
  WeeklyReport,
  addDays,
} from './store-models';

interface StoreState {
  ojts: OjtView[];
  reports: WeeklyReport[];
  corrections: CorrectionRequest[];
  notifications: AppNotification[];
  punches: Map<string, Punch[]>;
}

const EMPTY_STATE: StoreState = { ojts: [], reports: [], corrections: [], notifications: [], punches: new Map() };

const HISTORY_STATUS = { submit: 'submitted', approve: 'approved', return: 'returned' } as const;

export type NewCorrectionInput = Pick<CorrectionRequest, 'kind' | 'punchType' | 'date' | 'originalTime' | 'requestedTime' | 'reason'>;
export type CorrectionAddResult = { ok: boolean; reason?: 'reason-required' | 'future-date' | 'punch-not-found' };
export type CorrectionDecideResult = { ok: boolean; reason?: 'remark-required' | 'not-pending' };

/** An instant from a date and an HH:mm time in Asia/Manila (A-04). */
function manilaInstant(date: string, time: string): string {
  return new Date(`${date}T${time}:00+08:00`).toISOString();
}

/** Logged and approved minutes for each date. A session counts as approved when its time-in is approved. */
function dtrSummary(punches: readonly Punch[]): Pick<OjtView, 'dailyMinutes' | 'approvedDailyMinutes' | 'lastTimeIn'> {
  const inputs: PunchInput[] = punches.map((p) => ({ id: p.id, type: p.type, time: p.deviceTime, correctsPunchId: p.correctsPunchId }));
  const approved = new Set(punches.filter((p) => p.approved).map((p) => p.id));
  const sessions = buildSessions(inputs);
  const lastIn = [...punches].reverse().find((p) => p.type === 'in');
  return {
    dailyMinutes: Object.fromEntries(minutesByDate(sessions)),
    approvedDailyMinutes: Object.fromEntries(minutesByDate(sessions.filter((s) => approved.has(s.timeIn.id)))),
    lastTimeIn: lastIn?.deviceTime ?? null,
  };
}

/** The view of one OJT from its assignment details (empty values if the device has no assignment data yet). */
function ojtView(id: string, d: OjtDetails | undefined, punches: readonly Punch[]): OjtView {
  const { ojtId: _ojtId, ...fields } = d ?? { ojtId: id };
  return { ...EMPTY_OJT, ...fields, id, ...dtrSummary(punches) };
}

@Injectable({ providedIn: 'root' })
export class WorkStore {
  private readonly auth = inject(AuthService);
  private readonly sync = inject(SyncService);
  private readonly assignments = inject(AssignmentRepository);
  private readonly punchRepo = inject(PunchRepository);
  private readonly reportRepo = inject(ReportRepository);
  private readonly correctionRepo = inject(CorrectionRepository);
  private readonly notificationRepo = inject(NotificationRepository);
  private readonly attachments = inject(AttachmentRepository);
  private readonly device = inject(DeviceRepository);

  private readonly state = signal<StoreState>(EMPTY_STATE);
  private loadSeq = 0;

  /** True after the first load of the local data. */
  readonly loaded = signal(false);

  /** The ID of the logged-in user. For an OJT, it is also the OJT ID of the OJT screens. */
  readonly meId = computed(() => this.auth.profile()?.id ?? '');

  readonly reports = computed(() => this.state().reports);
  readonly corrections = computed(() => this.state().corrections);

  /** The OJT of this device (OJT role). Empty values until the first load. */
  readonly me = computed<OjtView>(() => {
    const id = this.meId();
    const found = this.state().ojts.find((o) => o.id === id);
    return found ?? { ...EMPTY_OJT, id, fullName: this.auth.profile()?.fullName ?? '' };
  });

  /** The facilitator view: the active OJTs of the facilitator (FR-MON-02). */
  readonly assignedOjts = computed(() => (this.auth.role() === 'facilitator' ? this.state().ojts : []));

  readonly pendingReports = computed(() => this.state().reports.filter((r) => r.status === 'submitted'));
  readonly pendingCorrections = computed(() => this.state().corrections.filter((c) => c.status === 'pending'));

  readonly notifications = computed(() => this.state().notifications);
  readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read).length);

  constructor() {
    // Load again after each local change, each sync, and each login.
    effect(() => {
      this.sync.revision();
      this.auth.profile();
      untracked(() => void this.refresh());
    });
  }

  // ---------- Reads ----------

  ojt(id: string): OjtView | undefined {
    return id === this.meId() ? this.me() : this.state().ojts.find((o) => o.id === id);
  }

  /** The minutes of each day of one week (Monday to Sunday), from the DTR (FR-RPT-02). */
  weekDays(ojtId: string, week: string): DayMinutes[] {
    const days = this.ojt(ojtId)?.dailyMinutes ?? {};
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(week, i);
      return { date, minutes: days[date] ?? 0 };
    });
  }

  weekMinutes(ojtId: string, week: string): number {
    return this.weekDays(ojtId, week).reduce((sum, d) => sum + d.minutes, 0);
  }

  /** The Mondays from the start date of the OJT (or the first punch) to this week, newest first. */
  weeksOf(ojtId: string): string[] {
    const o = this.ojt(ojtId);
    const thisWeek = weekStart(new Date());
    const firstPunch = Object.keys(o?.dailyMinutes ?? {}).sort()[0];
    const start = o?.startDate || firstPunch;
    const out: string[] = [];
    if (!start) {
      return [thisWeek];
    }
    for (let w = thisWeek; w >= weekStart(`${start}T12:00:00+08:00`); w = addDays(w, -7)) {
      out.push(w);
    }
    return out.length ? out : [thisWeek];
  }

  reportsOf(ojtId: string): WeeklyReport[] {
    return this.state().reports.filter((r) => r.ojtId === ojtId);
  }

  report(ojtId: string, week: string): WeeklyReport | undefined {
    return this.state().reports.find((r) => r.ojtId === ojtId && r.weekStart === week);
  }

  reportById(id: string): WeeklyReport | undefined {
    return this.state().reports.find((r) => r.id === id);
  }

  correctionsOf(ojtId: string): CorrectionRequest[] {
    return this.state().corrections.filter((c) => c.ojtId === ojtId);
  }

  correction(id: string): CorrectionRequest | undefined {
    return this.state().corrections.find((c) => c.id === id);
  }

  /** FR-RPT-03: the photos of a report that are on this device (data URLs). */
  photosOf(reportId: string): Promise<string[]> {
    return this.attachments.reportPhotos(reportId);
  }

  /** FR-MON-01: logged, approved (FR-RPT-07), and remaining hours. */
  progress(ojtId: string): HoursProgress {
    const o = this.ojt(ojtId);
    const requiredMinutes = (o?.requiredHours ?? 0) * 60;
    const minutes = Object.values(o?.dailyMinutes ?? {});
    const loggedMinutes = minutes.reduce((a, b) => a + b, 0);
    const approvedMinutes = Object.values(o?.approvedDailyMinutes ?? {}).reduce((a, b) => a + b, 0);
    const remainingMinutes = Math.max(0, requiredMinutes - approvedMinutes);
    const pct = (m: number) => (requiredMinutes ? Math.min(100, Math.round((m / requiredMinutes) * 100)) : 0);
    return {
      requiredMinutes,
      loggedMinutes,
      approvedMinutes,
      remainingMinutes,
      percent: pct(approvedMinutes),
      loggedPercent: pct(loggedMinutes),
      projectedEnd: requiredMinutes ? this.projectedEnd(requiredMinutes - loggedMinutes, minutes) : null,
    };
  }

  /** The report of the week, or a new draft that is not saved yet. */
  reportOrDraft(ojtId: string, week: string): WeeklyReport {
    return (
      this.report(ojtId, week) ?? {
        id: '',
        ojtId,
        weekStart: week,
        tasksDone: '',
        skillsLearned: '',
        problems: '',
        plansNextWeek: '',
        photoCount: 0,
        status: 'draft',
        history: [],
        updatedAt: '',
        syncStatus: 'none',
      }
    );
  }

  /** FR-RPT-06: the OJT can change a report only when the status is draft or returned. */
  canEdit(report: WeeklyReport): boolean {
    return canEditReport(report.status);
  }

  // ---------- OJT actions ----------

  /** FR-RPT-01: saves the content and the new photos as a draft. */
  async saveDraft(ojtId: string, week: string, content: ReportContent): Promise<ReportActionResult> {
    return this.writeReport(ojtId, week, content, false);
  }

  /** FR-RPT-04: saves and submits. Offline, the submit waits in the outbox. */
  async submit(ojtId: string, week: string, content: ReportContent): Promise<ReportActionResult> {
    return this.writeReport(ojtId, week, content, true);
  }

  /** FR-COR-01: a request to add a punch or to change the time of a punch. */
  async addCorrection(input: NewCorrectionInput): Promise<CorrectionAddResult> {
    if (!input.reason.trim()) {
      return { ok: false, reason: 'reason-required' };
    }
    if (input.date > localDate(new Date())) {
      return { ok: false, reason: 'future-date' };
    }
    const me = this.meId();
    let punchId: string | null = null;
    if (input.kind === 'change') {
      const punch = (this.state().punches.get(me) ?? []).find(
        (p) => p.type === input.punchType && localDate(p.deviceTime) === input.date && timeOfDay(p.deviceTime) === input.originalTime,
      );
      if (!punch) {
        return { ok: false, reason: 'punch-not-found' };
      }
      punchId = punch.id;
    }
    const result = await this.correctionRepo.create(
      {
        id: newId(),
        ojtId: me,
        kind: input.kind,
        punchId,
        punchType: input.kind === 'add' ? input.punchType : null,
        requestedTime: manilaInstant(input.date, input.requestedTime),
        reason: input.reason,
      },
      me,
    );
    if (!result.ok) {
      return { ok: false, reason: result.reason === 'future-time' ? 'future-date' : 'reason-required' };
    }
    await this.afterChange();
    return { ok: true };
  }

  // ---------- Facilitator actions ----------

  /** FR-RPT-05: approve, or return with a remark. The server approves the hours of the week (FR-RPT-07). */
  async reviewReport(id: string, decision: 'approved' | 'returned', remark: string): Promise<ReportActionResult> {
    const { deviceId } = await this.device.context();
    const result = await this.reportRepo.decide(id, decision === 'approved' ? 'approve' : 'return', remark, this.meId(), deviceId);
    if (!result.ok) {
      return { ok: false, reason: result.reason === 'remark-required' ? 'remark-required' : result.reason === 'not-found' ? 'not-found' : 'not-editable' };
    }
    await this.afterChange();
    return { ok: true, report: this.reportById(id) ?? this.reportOrDraft(result.report.ojtId, result.report.weekStart) };
  }

  /** FR-COR-02: approve, or reject with a remark. */
  async decideCorrection(id: string, decision: 'approved' | 'rejected', remark: string): Promise<CorrectionDecideResult> {
    const { deviceId } = await this.device.context();
    const result = await this.correctionRepo.decide(id, decision, remark, this.meId(), deviceId);
    if (!result.ok) {
      return { ok: false, reason: result.reason === 'remark-required' ? 'remark-required' : 'not-pending' };
    }
    await this.afterChange();
    return { ok: true };
  }

  // ---------- Notifications ----------

  async markRead(id: string): Promise<void> {
    await this.notificationRepo.markRead(id, this.meId());
    await this.afterChange();
  }

  async markAllRead(): Promise<void> {
    await this.notificationRepo.markAllRead(this.meId());
    await this.afterChange();
  }

  // ---------- Load ----------

  /** Reads the local data again. A newer load wins over an older load that ends later. */
  async refresh(): Promise<void> {
    const profile = this.auth.profile();
    const seq = ++this.loadSeq;
    if (!profile || profile.role === 'admin') {
      this.state.set(EMPTY_STATE);
      return;
    }
    try {
      const next = await this.load(profile.id, profile.role === 'facilitator');
      if (seq === this.loadSeq) {
        this.state.set(next);
        this.loaded.set(true);
      }
    } catch {
      // The local database is not available (for example, the web build). The screens show empty data.
    }
  }

  private async load(userId: string, facilitator: boolean): Promise<StoreState> {
    const ojtIds = facilitator ? (await this.assignments.ojtsOf(userId)).map((o) => o.ojtId) : [userId];
    const details = await this.assignments.details(ojtIds);
    const punches = new Map<string, Punch[]>();
    const names = new Map<string, string>();
    for (const id of ojtIds) {
      punches.set(id, await this.punchRepo.listByOjt(id));
    }
    const ownName = this.auth.profile()?.fullName ?? '';
    const ojts: OjtView[] = ojtIds.map((id) => {
      const view = ojtView(id, details.find((x) => x.ojtId === id), punches.get(id) ?? []);
      view.fullName ||= id === userId ? ownName : '';
      const d = details.find((x) => x.ojtId === id);
      names.set(id, view.fullName);
      if (d?.facilitatorName) {
        names.set('facilitator', d.facilitatorName);
      }
      return view;
    });
    names.set(userId, this.auth.profile()?.fullName ?? '');

    const reports: WeeklyReport[] = [];
    for (const id of ojtIds) {
      for (const r of await this.reportRepo.listByOjt(id)) {
        reports.push(await this.reportView(r, names));
      }
    }
    const records = facilitator ? await this.correctionRepo.listForOjts(ojtIds) : await this.correctionRepo.listByOjt(userId);
    const allPunches = [...punches.values()].flat();
    const corrections = records.map((c) => this.correctionView(c, allPunches));
    const notifications = (await this.notificationRepo.list(userId)).map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt ?? '',
      read: n.read,
      link: n.link ?? '',
    }));
    return { ojts, reports, corrections, notifications, punches };
  }

  private async reportView(r: ReportRecord, names: Map<string, string>): Promise<WeeklyReport> {
    const events = await this.reportRepo.events(r.id);
    const history: ReportHistoryEntry[] = events.map((e: ReportEvent) => ({
      at: e.createdAt ?? '',
      status: HISTORY_STATUS[e.action],
      by: names.get(e.actorId) || (e.actorId === r.ojtId ? names.get(r.ojtId) : names.get('facilitator')) || '',
      remark: e.remark ?? undefined,
    }));
    return {
      id: r.id,
      ojtId: r.ojtId,
      weekStart: r.weekStart,
      tasksDone: r.tasksDone,
      skillsLearned: r.skillsLearned,
      problems: r.problems,
      plansNextWeek: r.nextPlans,
      photoCount: await this.attachments.countReportPhotos(r.id),
      status: r.status,
      history,
      updatedAt: r.updatedAt ?? '',
      syncStatus: r.syncStatus,
    };
  }

  private correctionView(c: CorrectionRecord, punches: readonly Punch[]): CorrectionRequest {
    const original = c.punchId ? punches.find((p) => p.id === c.punchId) : undefined;
    return {
      id: c.id,
      ojtId: c.ojtId,
      kind: c.kind as CorrectionKind,
      punchType: c.punchType ?? original?.type ?? 'in',
      date: localDate(c.requestedTime),
      originalTime: original ? timeOfDay(original.deviceTime) : undefined,
      requestedTime: timeOfDay(c.requestedTime),
      reason: c.reason,
      status: c.status,
      remark: c.remark ?? undefined,
      createdAt: c.createdAt ?? c.requestedTime,
      decidedAt: c.decidedAt ?? undefined,
      syncStatus: c.syncStatus,
    };
  }

  // ---------- Internal ----------

  private async writeReport(ojtId: string, week: string, content: ReportContent, submit: boolean): Promise<ReportActionResult> {
    const existing = this.report(ojtId, week);
    if (existing && (existing.photoCount + content.photos.length) > MAX_REPORT_PHOTOS) {
      return { ok: false, reason: 'too-many-photos' };
    }
    const photos: LocalPhoto[] = [];
    for (const url of content.photos) {
      photos.push(await this.attachments.storePhoto(ojtId, await (await fetch(url)).blob()));
    }
    const fields = { tasksDone: content.tasksDone, skillsLearned: content.skillsLearned, problems: content.problems, nextPlans: content.plansNextWeek };
    const userId = this.meId();
    const result = submit
      ? await this.reportRepo.submit(ojtId, week, fields, userId, (await this.device.context()).deviceId, photos)
      : await this.reportRepo.saveDraft(ojtId, week, fields, userId, photos);
    if (!result.ok) {
      return { ok: false, reason: result.reason === 'incomplete' ? 'incomplete' : result.reason === 'not-found' ? 'not-found' : 'not-editable' };
    }
    await this.afterChange();
    return { ok: true, report: this.report(ojtId, week) ?? this.reportOrDraft(ojtId, week) };
  }

  /** Loads the new local data at once, then asks for a sync (offline sync design, section 6, trigger 3). */
  private async afterChange(): Promise<void> {
    await this.refresh();
    this.sync.changed();
  }

  /** The last day of the OJT at the mean minutes of a work day (Monday to Friday). */
  private projectedEnd(remaining: number, workDays: number[]): string | null {
    if (workDays.length === 0) {
      return null;
    }
    const mean = workDays.reduce((a, b) => a + b, 0) / workDays.length;
    if (mean <= 0) {
      return null;
    }
    let left = Math.ceil(Math.max(0, remaining) / mean);
    let day = localDate(new Date());
    while (left > 0) {
      day = addDays(day, 1);
      const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
      if (weekday !== 0 && weekday !== 6) {
        left--;
      }
    }
    return day;
  }
}

