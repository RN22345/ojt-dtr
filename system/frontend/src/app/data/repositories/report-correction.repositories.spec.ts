import { TestBed } from '@angular/core/testing';
import { PlatformService } from '../../core/platform.service';
import { SUPABASE } from '../../core/supabase.client';
import { LocalDb } from '../local-db/local-db';
import { LOCAL_DB_OPENER, LocalDbService } from '../local-db/local-db.service';
import { SqlJsDb } from '../local-db/sqljs.db';
import { markSynced } from '../sync/local-merge';
import { listOutbox, removeOp } from '../sync/outbox';
import { CorrectionRepository } from './correction.repository';
import { NotificationRepository } from './notification.repository';
import { ReportRepository } from './report.repository';

const OJT = '00000000-0000-4000-a000-000000000021';
const FAC = '00000000-0000-4000-a000-000000000011';
const WEEK = '2026-10-19';
const CONTENT = { tasksDone: 'Tasks', skillsLearned: 'Skills', problems: '', nextPlans: 'Plans' };

/** Acts as the server for one operation: it applies the operation and gives back the server record. */
async function applyFirst(db: LocalDb, userId: string, record: Record<string, unknown>): Promise<void> {
  const [op] = await listOutbox(db, userId);
  await removeOp(db, op.opId);
  await markSynced(db, op.entity, op.entityId, record);
}

describe('TC-CI-DB-02 report, correction, and notification repositories (FR-RPT-01 to 06, FR-COR-01, 02, FR-NOTI-05)', () => {
  let db: SqlJsDb;

  beforeEach(async () => {
    db = await SqlJsDb.create();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PlatformService, useValue: { platform: 'mobile' } },
        { provide: LOCAL_DB_OPENER, useValue: () => Promise.resolve(db as LocalDb) },
        { provide: SUPABASE, useValue: {} },
      ],
    });
  });
  afterEach(async () => {
    await db.close();
  });

  it('TC-CI-DB-02 many draft saves before a sync make one create operation', async () => {
    const repo = TestBed.inject(ReportRepository);
    await repo.saveDraft(OJT, WEEK, CONTENT, OJT);
    const second = await repo.saveDraft(OJT, WEEK, { ...CONTENT, problems: 'None' }, OJT);
    expect(second.ok && second.report).toMatchObject({ status: 'draft', problems: 'None', syncStatus: 'pending' });
    const ops = await listOutbox(db, OJT);
    expect(ops.map((o) => [o.entity, o.opType])).toEqual([['weekly_reports', 'create']]);
    expect((ops[0].payload as Record<string, unknown>)['problems']).toBe('None');
  });

  it('TC-CI-DB-02 submit queues the content and the submit event; the report locks (FR-RPT-04, FR-RPT-06)', async () => {
    const repo = TestBed.inject(ReportRepository);
    expect(await repo.submit(OJT, WEEK, { ...CONTENT, skillsLearned: ' ' }, OJT, 'dev-1')).toEqual({ ok: false, reason: 'incomplete' });

    const saved = await repo.saveDraft(OJT, WEEK, CONTENT, OJT);
    const id = saved.ok ? saved.report.id : '';
    await applyFirst(db, OJT, { id, ojt_id: OJT, week_start: WEEK, tasks_done: 'Tasks', skills_learned: 'Skills', problems: '', next_plans: 'Plans', status: 'draft', version: 1 });

    const submitted = await repo.submit(OJT, WEEK, { ...CONTENT, problems: 'One' }, OJT, 'dev-1');
    expect(submitted.ok && submitted.report.status).toBe('submitted');
    const ops = await listOutbox(db, OJT);
    expect(ops.map((o) => [o.entity, o.opType, o.baseVersion])).toEqual([
      ['weekly_reports', 'update', 1],
      ['report_events', 'create', null],
    ]);
    expect(ops[1].payload).toMatchObject({ report_id: id, action: 'submit', device_id: 'dev-1' });
    expect(await repo.saveDraft(OJT, WEEK, CONTENT, OJT)).toEqual({ ok: false, reason: 'not-editable' });
    expect((await repo.events(id)).map((e) => e.action)).toEqual(['submit']);
  });

  it('TC-CI-DB-02 a content change after a queued submit gets the next base version', async () => {
    const repo = TestBed.inject(ReportRepository);
    const saved = await repo.saveDraft(OJT, WEEK, CONTENT, OJT);
    const id = saved.ok ? saved.report.id : '';
    await applyFirst(db, OJT, { id, ojt_id: OJT, week_start: WEEK, tasks_done: 'Tasks', skills_learned: 'Skills', status: 'returned', version: 4 });
    await repo.saveDraft(OJT, WEEK, CONTENT, OJT); // update, base 4, queued
    await db.run("update outbox set status = 'sending'"); // the sync takes it
    await repo.saveDraft(OJT, WEEK, { ...CONTENT, problems: 'x' }, OJT);
    const ops = await listOutbox(db, OJT);
    expect(ops.map((o) => o.baseVersion)).toEqual([4, 5]);
  });

  it('TC-CI-DB-02 the facilitator decision rules (FR-RPT-05)', async () => {
    const repo = TestBed.inject(ReportRepository);
    const saved = await repo.saveDraft(OJT, WEEK, CONTENT, OJT);
    const id = saved.ok ? saved.report.id : '';
    expect(await repo.decide(id, 'approve', '', FAC, 'dev-2')).toEqual({ ok: false, reason: 'not-permitted' });
    await db.run("update weekly_reports set status = 'submitted' where id = ?", [id]);
    expect(await repo.decide(id, 'return', ' ', FAC, 'dev-2')).toEqual({ ok: false, reason: 'remark-required' });
    const ret = await repo.decide(id, 'return', 'Add details.', FAC, 'dev-2');
    expect(ret.ok && ret.report.status).toBe('returned');
    const events = await repo.events(id);
    expect(events.map((e) => [e.action, e.remark, e.actorId])).toEqual([['return', 'Add details.', FAC]]);
    expect((await listOutbox(db, FAC)).map((o) => o.entity)).toEqual(['report_events']);
  });

  it('TC-CI-DB-02 correction create and decide (FR-COR-01, FR-COR-02)', async () => {
    const repo = TestBed.inject(CorrectionRepository);
    const now = new Date('2026-10-28T00:00:00Z');
    const base = { id: 'c-1', ojtId: OJT, kind: 'add' as const, punchId: null, punchType: 'out' as const, requestedTime: '2026-10-27T09:00:00Z', reason: 'Forgot' };
    expect(await repo.create({ ...base, reason: ' ' }, OJT, now)).toEqual({ ok: false, reason: 'reason-required' });
    expect(await repo.create({ ...base, requestedTime: '2026-10-29T00:00:00Z' }, OJT, now)).toEqual({ ok: false, reason: 'future-time' });
    expect(await repo.create({ ...base, punchType: null }, OJT, now)).toEqual({ ok: false, reason: 'punch-required' });
    const created = await repo.create(base, OJT, now);
    expect(created.ok && created.request).toMatchObject({ status: 'pending', punchType: 'out', syncStatus: 'pending' });
    expect((await listOutbox(db, OJT))[0].payload).toEqual({
      id: 'c-1', ojt_id: OJT, punch_id: null, kind: 'add', punch_type: 'out', requested_time: '2026-10-27T09:00:00Z', reason: 'Forgot',
    });

    await applyFirst(db, OJT, { id: 'c-1', ojt_id: OJT, kind: 'add', punch_type: 'out', requested_time: '2026-10-27T09:00:00Z', reason: 'Forgot', status: 'pending', version: 1 });
    expect(await repo.decide('c-1', 'rejected', '', FAC, 'dev-2')).toEqual({ ok: false, reason: 'remark-required' });
    const approved = await repo.decide('c-1', 'approved', '', FAC, 'dev-2');
    expect(approved.ok && approved.request.status).toBe('approved');
    const [op] = await listOutbox(db, FAC);
    expect([op.opType, op.baseVersion, op.payload]).toEqual(['update', 1, { status: 'approved', remark: null, decided_device_id: 'dev-2' }]);
    expect(await repo.decide('c-1', 'rejected', 'x', FAC, 'dev-2')).toEqual({ ok: false, reason: 'not-pending' });
    expect((await repo.listForOjts([OJT])).map((c) => c.id)).toEqual(['c-1']);
  });

  it('TC-CI-DB-02 mark as read queues one operation for each notification (FR-NOTI-05)', async () => {
    const repo = TestBed.inject(NotificationRepository);
    await TestBed.inject(LocalDbService).db(); // runs the local migrations
    for (const [id, at] of [['n-1', '2026-10-27T01:00:00Z'], ['n-2', '2026-10-27T02:00:00Z']]) {
      await db.run(
        "insert into notifications (id, user_id, type, title, body, link, read, created_at, version) values (?, ?, 'report_approved', 'T', 'B', '/ojt/reports', 0, ?, 1)",
        [id, OJT, at],
      );
    }
    expect((await repo.list(OJT)).map((n) => n.id)).toEqual(['n-2', 'n-1']);
    await repo.markRead('n-1', OJT);
    await repo.markRead('n-1', OJT);
    await repo.markAllRead(OJT);
    const ops = await listOutbox(db, OJT);
    expect(ops.map((o) => [o.entityId, o.opType, o.payload])).toEqual([
      ['n-1', 'update', { read: true }],
      ['n-2', 'update', { read: true }],
    ]);
    expect((await repo.list(OJT)).every((n) => n.read)).toBe(true);
  });
});
