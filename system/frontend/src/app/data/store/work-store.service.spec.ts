import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { PlatformService } from '../../core/platform.service';
import { SUPABASE } from '../../core/supabase.client';
import { FILES } from '../../plugins/files.plugin';
import { LocalDb } from '../local-db/local-db';
import { LOCAL_DB_OPENER, LocalDbService } from '../local-db/local-db.service';
import { SqlJsDb } from '../local-db/sqljs.db';
import { listOutbox } from '../sync/outbox';
import { DeviceRepository } from '../repositories/device.repository';
import { SyncService } from '../sync/sync.service';
import { WorkStore } from './work-store.service';

const OJT = '00000000-0000-4000-a000-000000000021';
const FAC = '00000000-0000-4000-a000-000000000011';

describe('TC-CI-DB-02 work store on the local database (FR-MON-01, FR-RPT-02, FR-COR-01, FR-RPT-05)', () => {
  let db: SqlJsDb;
  const profile = signal<{ id: string; role: 'ojt' | 'facilitator'; fullName: string; status: 'active' } | null>(null);
  const changed = vi.fn();

  async function seed(): Promise<void> {
    await TestBed.inject(LocalDbService).db();
    await db.run(`insert into profiles (id, role, full_name, status) values (?, 'ojt', 'OJT One', 'active'), (?, 'facilitator', 'Fac One', 'active')`, [OJT, FAC]);
    await db.run(`insert into companies (id, name) values ('c1', 'Company A')`);
    await db.run(`insert into batches (id, name, start_date, end_date, required_hours) values ('b1', 'Batch 1', '2026-10-19', '2026-12-18', 100)`);
    await db.run(`insert into ojt_assignments (id, ojt_id, facilitator_id, company_id, batch_id) values ('a1', ?, ?, 'c1', 'b1')`, [OJT, FAC]);
    // Monday 2026-10-19: 08:00 to 17:00 Manila (9 h), approved. Tuesday: 08:00 to 12:00 (4 h), not approved.
    const punches: [string, string, string, number][] = [
      ['p1', 'in', '2026-10-19T00:00:00.000Z', 1],
      ['p2', 'out', '2026-10-19T09:00:00.000Z', 1],
      ['p3', 'in', '2026-10-20T00:00:00.000Z', 0],
      ['p4', 'out', '2026-10-20T04:00:00.000Z', 0],
    ];
    for (const [id, type, time, approved] of punches) {
      await db.run(
        `insert into punches (id, ojt_id, type, device_time, time_zone, device_id, approved, server_received_at, version)
         values (?, ?, ?, ?, 'Asia/Manila', 'd', ?, ?, 1)`,
        [id, OJT, type, time, approved, time],
      );
    }
  }

  beforeEach(async () => {
    db = await SqlJsDb.create();
    changed.mockReset();
    profile.set(null);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PlatformService, useValue: { platform: 'mobile' } },
        { provide: LOCAL_DB_OPENER, useValue: () => Promise.resolve(db as LocalDb) },
        { provide: SUPABASE, useValue: {} },
        { provide: FILES, useValue: { write: vi.fn(), read: vi.fn(), removeFolder: vi.fn() } },
        { provide: AuthService, useValue: { profile, role: computed(() => profile()?.role ?? null) } },
        { provide: SyncService, useValue: { revision: signal(0), changed } },
        { provide: DeviceRepository, useValue: { context: () => Promise.resolve({ deviceId: 'dev-1', clockOffsetS: 0 }) } },
      ],
    });
    await seed();
  });
  afterEach(async () => {
    await db.close();
  });

  it('TC-CI-DB-02 the OJT view has the assignment, the logged hours, and the approved hours', async () => {
    profile.set({ id: OJT, role: 'ojt', fullName: 'OJT One', status: 'active' });
    const store = TestBed.inject(WorkStore);
    await store.refresh();
    expect(store.me()).toMatchObject({ fullName: 'OJT One', companyName: 'Company A', facilitatorName: 'Fac One', batchName: 'Batch 1', requiredHours: 100 });
    expect(store.weekMinutes(OJT, '2026-10-19')).toBe(13 * 60);
    const p = store.progress(OJT);
    expect([p.loggedMinutes, p.approvedMinutes, p.remainingMinutes, p.percent]).toEqual([780, 540, 6000 - 540, 9]);
  });

  it('TC-CI-DB-02 a report submit and a correction go to the outbox and show at once', async () => {
    profile.set({ id: OJT, role: 'ojt', fullName: 'OJT One', status: 'active' });
    const store = TestBed.inject(WorkStore);
    await store.refresh();
    const content = { tasksDone: 'T', skillsLearned: 'S', problems: '', plansNextWeek: 'P', photos: [] };
    const result = await store.submit(OJT, '2026-10-19', content);
    expect(result.ok && result.report).toMatchObject({ status: 'submitted', plansNextWeek: 'P' });
    expect(store.report(OJT, '2026-10-19')?.history.map((h) => [h.status, h.by])).toEqual([['submitted', 'OJT One']]);

    expect(await store.addCorrection({ kind: 'change', punchType: 'out', date: '2026-10-20', originalTime: '11:00', requestedTime: '17:00', reason: 'Late' })).toEqual({
      ok: false,
      reason: 'punch-not-found',
    });
    expect(await store.addCorrection({ kind: 'change', punchType: 'out', date: '2026-10-20', originalTime: '12:00', requestedTime: '17:00', reason: 'Late' })).toEqual({ ok: true });
    expect(store.correctionsOf(OJT)[0]).toMatchObject({ kind: 'change', punchType: 'out', date: '2026-10-20', originalTime: '12:00', requestedTime: '17:00', status: 'pending' });

    const ops = await listOutbox(db, OJT);
    expect(ops.map((o) => o.entity)).toEqual(['weekly_reports', 'report_events', 'correction_requests']);
    expect(ops[2].payload).toMatchObject({ punch_id: 'p4', requested_time: '2026-10-20T09:00:00.000Z' });
    expect(changed).toHaveBeenCalled();
  });

  it('TC-CI-DB-02 the facilitator sees the assigned OJT and decides a submitted report', async () => {
    await db.run(`insert into weekly_reports (id, ojt_id, week_start, tasks_done, skills_learned, status, version) values ('r1', ?, '2026-10-19', 'T', 'S', 'submitted', 2)`, [OJT]);
    profile.set({ id: FAC, role: 'facilitator', fullName: 'Fac One', status: 'active' });
    const store = TestBed.inject(WorkStore);
    await store.refresh();
    expect(store.assignedOjts().map((o) => o.fullName)).toEqual(['OJT One']);
    expect(store.pendingReports().map((r) => r.id)).toEqual(['r1']);
    expect(await store.reviewReport('r1', 'returned', '')).toEqual({ ok: false, reason: 'remark-required' });
    const res = await store.reviewReport('r1', 'approved', '');
    expect(res.ok && res.report.status).toBe('approved');
    expect(store.pendingReports()).toEqual([]);
    expect((await listOutbox(db, FAC)).map((o) => [o.entity, (o.payload as { action: string }).action])).toEqual([['report_events', 'approve']]);
  });
});
