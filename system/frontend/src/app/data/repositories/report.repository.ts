// Weekly report repository: the only path to report data (frontend rule 3).
// Each change goes to the local database and the outbox in one transaction (FR-SYNC-01, FR-RPT-04).
// Status changes are report events (API contract, section 5.1). The rules are in shared/utils/report-rules.ts.
import { Injectable, inject } from '@angular/core';
import { LocalDb } from '../local-db/local-db';
import { LocalDbService } from '../local-db/local-db.service';
import { countOpenChanges, enqueue, findQueued, replacePayload } from '../sync/outbox';
import { createPayload } from '../sync/payloads';
import { ReportAction, ReportStatus, canEditReport, isCompleteForSubmit, needsRemark, nextStatus } from '../../shared/utils/report-rules';
import { newId, nowIso } from '../../shared/utils/uuid';
import { SyncStatus } from './punch.repository';

export interface ReportContent {
  tasksDone: string;
  skillsLearned: string;
  problems: string;
  nextPlans: string;
}

export interface WeeklyReport extends ReportContent {
  id: string;
  ojtId: string;
  weekStart: string;
  status: ReportStatus;
  version: number;
  updatedAt: string | null;
  syncStatus: SyncStatus;
}

export interface ReportEvent {
  id: string;
  reportId: string;
  actorId: string;
  action: ReportAction;
  remark: string | null;
  createdAt: string | null;
  syncStatus: SyncStatus;
}

export type ReportFailure = 'not-editable' | 'incomplete' | 'remark-required' | 'not-found' | 'not-permitted';
export type ReportResult = { ok: true; report: WeeklyReport } | { ok: false; reason: ReportFailure };

interface ReportRow {
  [key: string]: string | number | null;
  id: string;
  ojt_id: string;
  week_start: string;
  tasks_done: string;
  skills_learned: string;
  problems: string;
  next_plans: string;
  status: string;
  version: number;
  updated_at: string | null;
  sync_status: string;
}

interface EventRow {
  [key: string]: string | number | null;
  id: string;
  report_id: string;
  actor_id: string;
  action: string;
  remark: string | null;
  created_at: string | null;
  sync_status: string;
}

function fromRow(r: ReportRow): WeeklyReport {
  return {
    id: r.id,
    ojtId: r.ojt_id,
    weekStart: r.week_start,
    tasksDone: r.tasks_done,
    skillsLearned: r.skills_learned,
    problems: r.problems,
    nextPlans: r.next_plans,
    status: r.status as ReportStatus,
    version: r.version,
    updatedAt: r.updated_at,
    syncStatus: r.sync_status as SyncStatus,
  };
}

function eventFromRow(r: EventRow): ReportEvent {
  return {
    id: r.id,
    reportId: r.report_id,
    actorId: r.actor_id,
    action: r.action as ReportAction,
    remark: r.remark,
    createdAt: r.created_at,
    syncStatus: r.sync_status as SyncStatus,
  };
}

const CONTENT_PAYLOAD = (c: ReportContent) => ({
  tasks_done: c.tasksDone,
  skills_learned: c.skillsLearned,
  problems: c.problems,
  next_plans: c.nextPlans,
});

@Injectable({ providedIn: 'root' })
export class ReportRepository {
  private readonly local = inject(LocalDbService);

  /** The reports of one OJT, newest week first. */
  async listByOjt(ojtId: string): Promise<WeeklyReport[]> {
    const db = await this.local.db();
    const rows = await db.query<ReportRow>(
      'select * from weekly_reports where ojt_id = ? and deleted_at is null order by week_start desc',
      [ojtId],
    );
    return rows.map(fromRow);
  }

  /** The reports of the OJTs of a facilitator with one of the statuses (FR-RPT-05 review list). */
  async listByStatus(ojtIds: readonly string[], statuses: readonly ReportStatus[]): Promise<WeeklyReport[]> {
    if (!ojtIds.length || !statuses.length) {
      return [];
    }
    const db = await this.local.db();
    const rows = await db.query<ReportRow>(
      `select * from weekly_reports where deleted_at is null
         and ojt_id in (${ojtIds.map(() => '?').join(', ')})
         and status in (${statuses.map(() => '?').join(', ')})
       order by week_start desc`,
      [...ojtIds, ...statuses],
    );
    return rows.map(fromRow);
  }

  async getByWeek(ojtId: string, week: string): Promise<WeeklyReport | null> {
    const db = await this.local.db();
    const rows = await db.query<ReportRow>(
      'select * from weekly_reports where ojt_id = ? and week_start = ? and deleted_at is null',
      [ojtId, week],
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async getById(id: string): Promise<WeeklyReport | null> {
    const db = await this.local.db();
    const rows = await db.query<ReportRow>('select * from weekly_reports where id = ? and deleted_at is null', [id]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  /** FR-RPT-08: the status changes and remarks of a report, oldest first. */
  async events(reportId: string): Promise<ReportEvent[]> {
    const db = await this.local.db();
    const rows = await db.query<EventRow>(
      'select * from report_events where report_id = ? and deleted_at is null order by created_at, rowid',
      [reportId],
    );
    return rows.map(eventFromRow);
  }

  /** FR-RPT-01, FR-RPT-06: saves the content as a draft. A new week makes a new report. */
  async saveDraft(ojtId: string, week: string, content: ReportContent, userId: string): Promise<ReportResult> {
    const db = await this.local.db();
    const result = await db.transaction((tx) => this.writeContent(tx, ojtId, week, content, userId));
    return this.done(result);
  }

  /** FR-RPT-04: saves the content and submits. Offline, the submit waits in the outbox. */
  async submit(ojtId: string, week: string, content: ReportContent, userId: string, deviceId: string): Promise<ReportResult> {
    if (!isCompleteForSubmit(content)) {
      return { ok: false, reason: 'incomplete' };
    }
    const db = await this.local.db();
    const result = await db.transaction(async (tx) => {
      const saved = await this.writeContent(tx, ojtId, week, content, userId);
      if (typeof saved !== 'string') {
        return saved;
      }
      await this.addEvent(tx, saved, 'submit', null, userId, deviceId);
      return saved;
    });
    return this.done(result);
  }

  /** FR-RPT-05: the facilitator approves, or returns with a remark. The server applies FR-RPT-07. */
  async decide(reportId: string, action: 'approve' | 'return', remark: string, userId: string, deviceId: string): Promise<ReportResult> {
    const report = await this.getById(reportId);
    if (!report) {
      return { ok: false, reason: 'not-found' };
    }
    if (!nextStatus(report.status, action)) {
      return { ok: false, reason: 'not-permitted' };
    }
    if (needsRemark(action) && !remark.trim()) {
      return { ok: false, reason: 'remark-required' };
    }
    const db = await this.local.db();
    await db.transaction((tx) => this.addEvent(tx, reportId, action, remark.trim() || null, userId, deviceId));
    return this.done(reportId);
  }

  /** Writes the content locally and to the outbox. Returns the report ID, or the cause of the failure. */
  private async writeContent(
    tx: LocalDb,
    ojtId: string,
    week: string,
    content: ReportContent,
    userId: string,
  ): Promise<string | { ok: false; reason: ReportFailure }> {
    const rows = await tx.query<ReportRow>('select * from weekly_reports where ojt_id = ? and week_start = ?', [ojtId, week]);
    const current = rows[0];
    const fields = CONTENT_PAYLOAD(content);

    if (!current) {
      const id = newId();
      const row = { id, ojt_id: ojtId, week_start: week, ...fields };
      await tx.run(
        `insert into weekly_reports (id, ojt_id, week_start, tasks_done, skills_learned, problems, next_plans,
           status, version, updated_at, created_at, sync_status)
         values (?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?, ?, 'pending')`,
        [id, ojtId, week, fields.tasks_done, fields.skills_learned, fields.problems, fields.next_plans, nowIso(), nowIso()],
      );
      await enqueue(tx, { userId, entity: 'weekly_reports', entityId: id, opType: 'create', payload: createPayload('weekly_reports', row) });
      return id;
    }

    if (!canEditReport(current.status as ReportStatus)) {
      return { ok: false, reason: 'not-editable' };
    }
    await tx.run(
      `update weekly_reports set tasks_done = ?, skills_learned = ?, problems = ?, next_plans = ?, updated_at = ?,
         sync_status = 'pending' where id = ?`,
      [fields.tasks_done, fields.skills_learned, fields.problems, fields.next_plans, nowIso(), current.id],
    );
    const queued = await findQueued(tx, 'weekly_reports', current.id);
    if (queued) {
      await replacePayload(tx, queued.opId, { ...(queued.payload as object), ...fields });
    } else {
      const open = await countOpenChanges(tx, 'weekly_reports', current.id, { entity: 'report_events', column: 'report_id' });
      await enqueue(tx, {
        userId,
        entity: 'weekly_reports',
        entityId: current.id,
        opType: 'update',
        payload: fields,
        baseVersion: current.version + open,
      });
    }
    return current.id;
  }

  private async addEvent(tx: LocalDb, reportId: string, action: ReportAction, remark: string | null, userId: string, deviceId: string): Promise<void> {
    const rows = await tx.query<{ status: string }>('select status from weekly_reports where id = ?', [reportId]);
    const next = rows[0] ? nextStatus(rows[0].status as ReportStatus, action) : null;
    if (!next) {
      throw new Error(`Action ${action} is not permitted for report ${reportId}.`);
    }
    const id = newId();
    await tx.run(
      `insert into report_events (id, report_id, actor_id, action, device_id, remark, created_at, version, sync_status)
       values (?, ?, ?, ?, ?, ?, ?, 0, 'pending')`,
      [id, reportId, userId, action, deviceId, remark, nowIso()],
    );
    await tx.run('update weekly_reports set status = ?, updated_at = ? where id = ?', [next, nowIso(), reportId]);
    await enqueue(tx, {
      userId,
      entity: 'report_events',
      entityId: id,
      opType: 'create',
      payload: { id, report_id: reportId, action, remark, device_id: deviceId },
    });
  }

  private async done(result: string | { ok: false; reason: ReportFailure }): Promise<ReportResult> {
    if (typeof result !== 'string') {
      return result;
    }
    const report = await this.getById(result);
    return report ? { ok: true, report } : { ok: false, reason: 'not-found' };
  }
}
