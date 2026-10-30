// L2 tests of the S3 sync_push entities against dev: report actions, correction requests, notifications, audit.
// TC-CI-RPT-01, TC-CI-RPT-02, TC-CI-AUD-01 (offline sync design, section 7; API contract, section 5.1).
// ojt4 (facilitator fac1) is the test OJT. ojt6 (facilitator fac2) is the other OJT.
// NOTE: Reports and punches cannot be deleted. Each run uses a new past week of ojt4 and leaves its records on dev.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SEED, signedIn } from './helpers';

interface PushResult {
  op_id: string;
  result: 'applied' | 'duplicate' | 'conflict' | 'rejected';
  cause?: string;
  record?: Record<string, unknown> | null;
}

function op(entity: string, opType: 'create' | 'update', id: string, payload: Record<string, unknown>, baseVersion: number | null = null) {
  return { op_id: randomUUID(), entity, entity_id: id, op_type: opType, payload, base_version: baseVersion };
}

async function push(client: SupabaseClient, ops: unknown[]): Promise<PushResult[]> {
  const { data, error } = await client.rpc('sync_push', { p_ops: ops, p_device_now: new Date().toISOString() });
  if (error) {
    throw new Error(`sync_push failed: ${error.message}`);
  }
  return (data as { results: PushResult[] }).results;
}

/** A Monday that ojt4 has no report for: a random week from 2001 to 2020. */
async function freeWeek(client: SupabaseClient): Promise<string> {
  for (let tries = 0; tries < 20; tries++) {
    const monday = new Date(Date.UTC(2001, 0, 1) + Math.floor(Math.random() * 1040) * 7 * 86400000);
    const week = monday.toISOString().slice(0, 10);
    const { data } = await client.from('weekly_reports').select('id').eq('ojt_id', SEED.ojt4.id).eq('week_start', week);
    if (!data?.length) {
      return week;
    }
  }
  throw new Error('No free week found for ojt4');
}

/** An ISO time on a day of the week, at the hour in Asia/Manila. */
function manilaTime(week: string, dayOffset: number, hour: number): string {
  const d = new Date(`${week}T00:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(d.getUTCHours() + hour);
  return d.toISOString();
}

function punch(week: string, dayOffset: number, hour: number, type: 'in' | 'out'): Record<string, unknown> {
  return {
    id: randomUUID(),
    ojt_id: SEED.ojt4.id,
    type,
    device_time: manilaTime(week, dayOffset, hour),
    time_zone: 'Asia/Manila',
    clock_offset_s: 0,
    device_id: 'l2-test-device',
  };
}

async function newReport(ojt: SupabaseClient, week: string, content: Record<string, string>): Promise<string> {
  const id = randomUUID();
  const [res] = await push(ojt, [op('weekly_reports', 'create', id, { id, ojt_id: SEED.ojt4.id, week_start: week, ...content })]);
  expect(res.result).toBe('applied');
  return id;
}

function event(reportId: string, action: string, remark: string | null = null) {
  const id = randomUUID();
  return op('report_events', 'create', id, { id, report_id: reportId, action, remark, device_id: 'l2-test-device' });
}

const CONTENT = { tasks_done: 'Set up the test bench.', skills_learned: 'Git branches.', problems: '', next_plans: 'Write tests.' };

let ojt4: SupabaseClient;
let ojt6: SupabaseClient;
let fac1: SupabaseClient;
let fac2: SupabaseClient;
let admin: SupabaseClient;

beforeAll(async () => {
  [ojt4, ojt6, fac1, fac2, admin] = await Promise.all([
    signedIn(SEED.ojt4.email),
    signedIn(SEED.ojt6.email),
    signedIn(SEED.fac1.email),
    signedIn(SEED.fac2.email),
    signedIn(SEED.admin.email),
  ]);
});

afterAll(async () => {
  await Promise.all([ojt4, ojt6, fac1, fac2, admin].map((c) => c?.auth.signOut({ scope: 'local' })));
});

describe('TC-CI-RPT-01 approval approves the week (FR-RPT-07, FR-RPT-08, FR-AUD-01)', () => {
  it('TC-CI-RPT-01: submit, return, submit again, approve; punches of the week become approved', async () => {
    const week = await freeWeek(ojt4);
    const inside = [punch(week, 0, 8, 'in'), punch(week, 0, 17, 'out')];
    const outside = punch(week, 7, 8, 'in'); // Monday of the next week
    const punchResults = await push(ojt4, [...inside, outside].map((p) => op('punches', 'create', p['id'] as string, p)));
    expect(punchResults.map((r) => r.result)).toEqual(['applied', 'applied', 'applied']);

    // An incomplete report cannot be submitted.
    const emptyId = await newReport(ojt4, week, { tasks_done: '', skills_learned: '' });
    const [incomplete] = await push(ojt4, [event(emptyId, 'submit')]);
    expect(incomplete).toMatchObject({ result: 'rejected', cause: 'incomplete' });

    const [content] = await push(ojt4, [op('weekly_reports', 'update', emptyId, CONTENT, 1)]);
    expect(content.result).toBe('applied');
    const reportId = emptyId;

    const [submit] = await push(ojt4, [event(reportId, 'submit')]);
    expect(submit.result).toBe('applied');

    // A submitted report cannot change (FR-RPT-06).
    const [locked] = await push(ojt4, [op('weekly_reports', 'update', reportId, { problems: 'x' }, 3)]);
    expect(locked).toMatchObject({ result: 'rejected', cause: 'not_editable' });

    // The other facilitator cannot decide. A return needs a remark.
    const [other] = await push(fac2, [event(reportId, 'approve')]);
    expect(other).toMatchObject({ result: 'rejected', cause: 'forbidden' });
    const [noRemark] = await push(fac1, [event(reportId, 'return', '  ')]);
    expect(noRemark).toMatchObject({ result: 'rejected', cause: 'remark_required' });

    const [ret] = await push(fac1, [event(reportId, 'return', 'Add the problems.')]);
    expect(ret.result).toBe('applied');
    const [resubmit] = await push(ojt4, [event(reportId, 'submit')]);
    expect(resubmit.result).toBe('applied');
    const [approve] = await push(fac1, [event(reportId, 'approve')]);
    expect(approve.result).toBe('applied');

    const { data: report } = await ojt4.from('weekly_reports').select('status').eq('id', reportId).single();
    expect(report?.status).toBe('approved');

    const { data: punches } = await fac1
      .from('punches')
      .select('id, approved')
      .in('id', [...inside, outside].map((p) => p['id'] as string));
    const approved = new Map((punches ?? []).map((p) => [p.id, p.approved]));
    expect(inside.map((p) => approved.get(p['id'] as string))).toEqual([true, true]);
    expect(approved.get(outside['id'] as string)).toBe(false);

    // FR-RPT-08: the history has each action with its remark.
    const { data: events } = await ojt4.from('report_events').select('action, remark').eq('report_id', reportId).order('created_at');
    expect(events?.map((e) => e.action)).toEqual(['submit', 'return', 'submit', 'approve']);
    expect(events?.[1].remark).toBe('Add the problems.');

    // FR-NOTI-05: the OJT gets a notification, and only the owner can mark it as read.
    const { data: notes } = await ojt4
      .from('notifications')
      .select('id, type, read, link')
      .eq('type', 'report_approved')
      .eq('link', `/ojt/reports/${week}`);
    expect(notes?.length).toBe(1);
    const noteId = notes![0].id as string;
    const [foreign] = await push(ojt6, [op('notifications', 'update', noteId, { read: true })]);
    expect(foreign).toMatchObject({ result: 'rejected', cause: 'forbidden' });
    const [read] = await push(ojt4, [op('notifications', 'update', noteId, { read: true })]);
    expect(read.result).toBe('applied');
    expect(read.record?.['read']).toBe(true);

    // FR-AUD-01: each status change has an audit entry.
    const { data: audit } = await admin
      .from('audit_logs')
      .select('actor_id, action, before_data, after_data')
      .eq('entity', 'weekly_reports')
      .eq('entity_id', reportId)
      .order('created_at');
    expect(audit?.map((a) => (a.after_data as { status: string }).status)).toEqual(['submitted', 'returned', 'submitted', 'approved']);
    expect(audit?.[3].actor_id).toBe(SEED.fac1.id);
  });
});

describe('TC-CI-RPT-02 first decision wins (FR-RPT-05, FR-COR-02)', () => {
  it('TC-CI-RPT-02: a second report decision gives conflict', async () => {
    const week = await freeWeek(ojt4);
    const reportId = await newReport(ojt4, week, CONTENT);
    expect((await push(ojt4, [event(reportId, 'submit')]))[0].result).toBe('applied');
    expect((await push(fac1, [event(reportId, 'approve')]))[0].result).toBe('applied');
    const [second] = await push(fac1, [event(reportId, 'return', 'Too late.')]);
    expect(second).toMatchObject({ result: 'conflict', cause: 'decided' });
  });

  it('TC-CI-RPT-02: a second correction decision gives conflict', async () => {
    const id = randomUUID();
    const created = await push(ojt4, [
      op('correction_requests', 'create', id, {
        id,
        ojt_id: SEED.ojt4.id,
        kind: 'add',
        punch_type: 'out',
        requested_time: manilaTime('2026-10-05', 0, 17),
        reason: 'I forgot the time-out.',
      }),
    ]);
    expect(created[0].result).toBe('applied');
    expect((await push(fac1, [op('correction_requests', 'update', id, { status: 'rejected', remark: 'No proof.' })]))[0].result).toBe('applied');
    const [second] = await push(fac1, [op('correction_requests', 'update', id, { status: 'approved' })]);
    expect(second).toMatchObject({ result: 'conflict', cause: 'decided' });
    expect(second.record?.['status']).toBe('rejected');
  });
});

describe('TC-CI-AUD-01 audit entries (FR-AUD-01, QR-SE-07) and correction rules (FR-COR-01 to FR-COR-03)', () => {
  it('TC-CI-AUD-01: an approved correction makes a new punch; the original stays; each step is audited', async () => {
    const week = await freeWeek(ojt4);
    const original = punch(week, 1, 9, 'in');
    expect((await push(ojt4, [op('punches', 'create', original['id'] as string, original)]))[0].result).toBe('applied');

    // Validation: a reason, a time that is not in the future, an own punch.
    const bad = randomUUID();
    const [future] = await push(ojt4, [
      op('correction_requests', 'create', bad, {
        id: bad,
        ojt_id: SEED.ojt4.id,
        kind: 'add',
        punch_type: 'in',
        requested_time: new Date(Date.now() + 3600000).toISOString(),
        reason: 'Future',
      }),
    ]);
    expect(future).toMatchObject({ result: 'rejected', cause: 'invalid_data' });
    const [noReason] = await push(ojt4, [
      op('correction_requests', 'create', bad, {
        id: bad,
        ojt_id: SEED.ojt4.id,
        kind: 'change',
        punch_id: original['id'],
        requested_time: manilaTime(week, 1, 8),
        reason: ' ',
      }),
    ]);
    expect(noReason).toMatchObject({ result: 'rejected', cause: 'invalid_data' });

    const id = randomUUID();
    const [created] = await push(ojt4, [
      op('correction_requests', 'create', id, {
        id,
        ojt_id: SEED.ojt4.id,
        kind: 'change',
        punch_id: original['id'],
        requested_time: manilaTime(week, 1, 8),
        reason: 'I arrived at 08:00.',
      }),
    ]);
    expect(created.result).toBe('applied');

    const [noRemark] = await push(fac1, [op('correction_requests', 'update', id, { status: 'rejected' })]);
    expect(noRemark).toMatchObject({ result: 'rejected', cause: 'remark_required' });
    const [byOther] = await push(fac2, [op('correction_requests', 'update', id, { status: 'approved' })]);
    expect(byOther).toMatchObject({ result: 'rejected', cause: 'forbidden' });
    const [approved] = await push(fac1, [op('correction_requests', 'update', id, { status: 'approved', remark: 'OK.' })]);
    expect(approved.result).toBe('applied');
    expect(approved.record).toMatchObject({ status: 'approved', decided_by: SEED.fac1.id });

    const { data: rows } = await ojt4
      .from('punches')
      .select('id, type, device_time, corrects_punch_id, correction_id')
      .or(`id.eq.${original['id']},correction_id.eq.${id}`);
    const orig = rows?.find((r) => r.id === original['id']);
    const fix = rows?.find((r) => r.correction_id === id);
    expect(new Date(orig!.device_time).toISOString()).toBe(original['device_time']);
    expect(fix).toMatchObject({ type: 'in', corrects_punch_id: original['id'] });
    expect(new Date(fix!.device_time).toISOString()).toBe(manilaTime(week, 1, 8));

    const { data: audit } = await admin.from('audit_logs').select('entity, actor_id').or(`entity_id.eq.${id},entity_id.eq.${fix!.id}`);
    expect(audit?.map((a) => a.entity).sort()).toEqual(['correction_requests', 'punches']);
    expect(audit?.every((a) => a.actor_id === SEED.fac1.id)).toBe(true);
  });

  it('TC-CI-AUD-01: no user can change or delete an audit entry', async () => {
    const { data: one } = await admin.from('audit_logs').select('id').limit(1).single();
    const upd = await admin.from('audit_logs').update({ action: 'x' }).eq('id', one!.id).select();
    expect(upd.error ?? upd.data?.length === 0).toBeTruthy();
    const del = await admin.from('audit_logs').delete().eq('id', one!.id).select();
    expect(del.error ?? del.data?.length === 0).toBeTruthy();
    const { data: ojtView } = await ojt4.from('audit_logs').select('id').limit(1);
    expect(ojtView).toEqual([]);
  });
});
