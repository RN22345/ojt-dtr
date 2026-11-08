import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env, newClient, SEED, signedIn } from './helpers';

// TC-CI-ADM-01 (FR-ADM, FR-AUTH-07, D-70): admin accounts, assignments, companies, batches, and dashboard.
// Each run makes new test accounts, one test batch, and test assignments. The cleanup deactivates the
// accounts and the assignments and marks the batch as deleted. The rows stay on dev.
const STAMP = Date.now();
const PASSWORD = 'Adm-Test-pass-1';
const PASSWORD_2 = 'Adm-Test-pass-2';
const COMPANY_B = '10000000-0000-4000-a000-000000000002';

let admin: SupabaseClient;
const createdUsers: string[] = [];
const createdAssignments: string[] = [];
const createdBatches: string[] = [];

async function callAdmin(client: SupabaseClient, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const token = (await client.auth.getSession()).data.session!.access_token;
  const res = await fetch(`${env('SUPABASE_URL')}/functions/v1/admin-users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: env('SUPABASE_ANON_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function createUser(role: string, tag: string): Promise<{ id: string; email: string }> {
  const email = `adm-test-${STAMP}-${tag}@example.test`;
  const res = await callAdmin(admin, { action: 'create', email, password: PASSWORD, full_name: `Adm Test ${tag}`, role });
  expect(res.status).toBe(200);
  const id = res.json['user_id'] as string;
  createdUsers.push(id);
  return { id, email };
}

async function login(email: string, password: string) {
  return newClient().auth.signInWithPassword({ email, password });
}

beforeAll(async () => {
  admin = await signedIn(SEED.admin.email);
});

afterAll(async () => {
  for (const id of createdAssignments) {
    await admin.from('ojt_assignments').update({ active: false }).eq('id', id);
  }
  for (const id of createdBatches) {
    await admin.from('batches').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  }
  for (const id of createdUsers) {
    await callAdmin(admin, { action: 'deactivate', user_id: id });
  }
  await admin.auth.signOut();
});

describe('TC-CI-ADM-01 account actions of admin-users', () => {
  let user: { id: string; email: string };

  it('TC-CI-ADM-01 create makes a profile with the role, the name, and the contact number', async () => {
    const email = `adm-test-${STAMP}-main@example.test`;
    const res = await callAdmin(admin, {
      action: 'create', email, password: PASSWORD, full_name: 'Adm Test Main', role: 'ojt', contact_no: '+63 912 345 6789',
    });
    expect(res.status).toBe(200);
    const id = res.json['user_id'] as string;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    createdUsers.push(id);
    user = { id, email };

    const profile = await admin.from('profiles').select('role, full_name, contact_no, status').eq('id', id).single();
    expect(profile.data).toEqual({ role: 'ojt', full_name: 'Adm Test Main', contact_no: '+63 912 345 6789', status: 'active' });
    const signIn = await login(email, PASSWORD);
    expect(signIn.error).toBeNull();
    expect(signIn.data.user!.app_metadata['role']).toBe('ojt');
  });

  it('TC-CI-ADM-01 update changes the name, the contact number, and the role', async () => {
    const res = await callAdmin(admin, { action: 'update', user_id: user.id, full_name: 'Adm Test Renamed', contact_no: '0917', role: 'facilitator' });
    expect(res).toEqual({ status: 200, json: { ok: true } });
    const profile = await admin.from('profiles').select('role, full_name, contact_no').eq('id', user.id).single();
    expect(profile.data).toEqual({ role: 'facilitator', full_name: 'Adm Test Renamed', contact_no: '0917' });
    const back = await callAdmin(admin, { action: 'update', user_id: user.id, role: 'ojt' });
    expect(back.status).toBe(200);
  });

  it('TC-CI-ADM-01 the audit entry of a change has the calling admin as the actor', async () => {
    const { data } = await admin
      .from('audit_logs')
      .select('actor_id, action, after_data')
      .eq('entity', 'profiles')
      .eq('entity_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    expect(data).toMatchObject({ actor_id: SEED.admin.id, action: 'update' });
    expect(data!.after_data['role']).toBe('ojt');
  });

  it('TC-CI-ADM-01 deactivate stops the login, and activate allows it again', async () => {
    const off = await callAdmin(admin, { action: 'deactivate', user_id: user.id });
    expect(off).toEqual({ status: 200, json: { ok: true } });
    const status = await admin.from('profiles').select('status').eq('id', user.id).single();
    expect(status.data!.status).toBe('inactive');
    expect((await login(user.email, PASSWORD)).error).not.toBeNull();

    const on = await callAdmin(admin, { action: 'activate', user_id: user.id });
    expect(on).toEqual({ status: 200, json: { ok: true } });
    expect((await login(user.email, PASSWORD)).error).toBeNull();
  });

  it('TC-CI-ADM-01 reset_password sets a new password', async () => {
    const res = await callAdmin(admin, { action: 'reset_password', user_id: user.id, password: PASSWORD_2 });
    expect(res).toEqual({ status: 200, json: { ok: true } });
    expect((await login(user.email, PASSWORD)).error).not.toBeNull();
    expect((await login(user.email, PASSWORD_2)).error).toBeNull();
  });

  it('TC-CI-ADM-01 validation errors give clear codes', async () => {
    const ok = { email: `adm-test-${STAMP}-bad@example.test`, password: PASSWORD, full_name: 'Bad', role: 'ojt' };
    const cases: [Record<string, unknown>, number, string][] = [
      [{ action: 'create', ...ok, email: 'not-an-email' }, 400, 'invalid_email'],
      [{ action: 'create', ...ok, password: 'short' }, 400, 'weak_password'],
      [{ action: 'create', ...ok, role: 'boss' }, 400, 'invalid_role'],
      [{ action: 'create', ...ok, full_name: '' }, 400, 'invalid_full_name'],
      [{ action: 'create', ...ok, full_name: 'x'.repeat(201) }, 400, 'invalid_full_name'],
      [{ action: 'create', ...ok, contact_no: 'abc' }, 400, 'invalid_contact_no'],
      [{ action: 'create', ...ok, email: SEED.ojt1.email }, 400, 'email_taken'],
      [{ action: 'update', user_id: 'nope', full_name: 'x' }, 400, 'invalid_user_id'],
      [{ action: 'update', user_id: user.id }, 400, 'no_changes'],
      [{ action: 'update', user_id: '00000000-0000-4000-a000-0000000000ff', full_name: 'x' }, 404, 'not_found'],
      [{ action: 'update', user_id: SEED.admin.id, role: 'ojt' }, 400, 'self_role_change'],
      [{ action: 'deactivate', user_id: SEED.admin.id }, 400, 'self_deactivate'],
      [{ action: 'deactivate', user_id: '00000000-0000-4000-a000-0000000000ff' }, 404, 'not_found'],
      [{ action: 'reset_password', user_id: user.id, password: '123' }, 400, 'weak_password'],
      [{ action: 'reset_password', user_id: '00000000-0000-4000-a000-0000000000ff', password: PASSWORD }, 404, 'not_found'],
      [{ action: 'fly' }, 400, 'unknown_action'],
    ];
    for (const [body, status, code] of cases) {
      const res = await callAdmin(admin, body);
      expect({ body: body['action'], status: res.status, error: res.json['error'] }).toEqual({ body: body['action'], status, error: code });
    }
  });

  it('TC-CI-ADM-01 the admin stays active after the rejected self-deactivation', async () => {
    const { data } = await admin.from('profiles').select('status').eq('id', SEED.admin.id).single();
    expect(data!.status).toBe('active');
  });

  it('TC-CI-ADM-01 an OPTIONS request gets the CORS headers', async () => {
    const res = await fetch(`${env('SUPABASE_URL')}/functions/v1/admin-users`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:4200', 'Access-Control-Request-Method': 'POST' },
    });
    expect(res.status).toBeLessThan(300);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-headers')).toContain('authorization');
  });
});

describe('TC-CI-ADM-01 assignments (one active assignment for each OJT)', () => {
  it('TC-CI-ADM-01 a second active assignment fails, and a move is: old inactive, then new', async () => {
    const ojt = await createUser('ojt', 'asg');
    const first = await admin
      .from('ojt_assignments')
      .insert({ ojt_id: ojt.id, facilitator_id: SEED.fac1.id, company_id: SEED.companyA, batch_id: SEED.batch1 })
      .select('id')
      .single();
    expect(first.error).toBeNull();
    createdAssignments.push(first.data!.id);

    const second = await admin
      .from('ojt_assignments')
      .insert({ ojt_id: ojt.id, facilitator_id: SEED.fac2.id, company_id: COMPANY_B, batch_id: SEED.batch1 });
    expect(second.error?.code).toBe('23505');

    const off = await admin.from('ojt_assignments').update({ active: false }).eq('id', first.data!.id).select('id');
    expect(off.error).toBeNull();
    const moved = await admin
      .from('ojt_assignments')
      .insert({ ojt_id: ojt.id, facilitator_id: SEED.fac2.id, company_id: COMPANY_B, batch_id: SEED.batch1 })
      .select('id')
      .single();
    expect(moved.error).toBeNull();
    createdAssignments.push(moved.data!.id);

    const dash = await admin.rpc('admin_dashboard');
    const row = (dash.data ?? []).find((r: { ojt_id: string }) => r.ojt_id === ojt.id);
    expect(row).toMatchObject({ facilitator_id: SEED.fac2.id, company_id: COMPANY_B, batch_id: SEED.batch1, logged_minutes: 0 });

    // The cleanup of the old assignment: the old row stays inactive, so only the new one counts.
    await admin.from('ojt_assignments').update({ active: false }).eq('id', moved.data!.id);
    const after = await admin.rpc('admin_dashboard');
    expect((after.data ?? []).some((r: { ojt_id: string }) => r.ojt_id === ojt.id)).toBe(false);
  });
});

describe('TC-CI-ADM-01 company settings', () => {
  it('TC-CI-ADM-01 the photo and location settings of a company save', async () => {
    const before = await admin.from('companies').select('photo_required, location_required').eq('id', COMPANY_B).single();
    const flipped = { photo_required: !before.data!.photo_required, location_required: !before.data!.location_required };
    try {
      const upd = await admin.from('companies').update(flipped).eq('id', COMPANY_B).select('photo_required, location_required').single();
      expect(upd.error).toBeNull();
      expect(upd.data).toEqual(flipped);
    } finally {
      await admin.from('companies').update(before.data!).eq('id', COMPANY_B);
    }
    const restored = await admin.from('companies').select('photo_required, location_required').eq('id', COMPANY_B).single();
    expect(restored.data).toEqual(before.data);
  });
});

describe('TC-CI-ADM-01 batches', () => {
  it('TC-CI-ADM-01 a batch can be created and changed', async () => {
    const ins = await admin
      .from('batches')
      .insert({ name: `L2 admin test ${STAMP}`, start_date: '2027-02-01', end_date: '2027-05-28', required_hours: 300 })
      .select('id, required_hours')
      .single();
    expect(ins.error).toBeNull();
    createdBatches.push(ins.data!.id);

    const upd = await admin.from('batches').update({ required_hours: 320, end_date: '2027-06-04' }).eq('id', ins.data!.id).select('required_hours, end_date').single();
    expect(upd.error).toBeNull();
    expect(upd.data).toEqual({ required_hours: 320, end_date: '2027-06-04' });
  });

  it('TC-CI-ADM-01 an end date before the start date fails', async () => {
    const ins = await admin
      .from('batches')
      .insert({ name: `L2 bad ${STAMP}`, start_date: '2027-03-01', end_date: '2027-02-01', required_hours: 100 });
    expect(ins.error?.code).toBe('23514');

    const upd = await admin.from('batches').update({ end_date: '2027-01-01' }).eq('id', createdBatches[0]);
    expect(upd.error?.code).toBe('23514');
  });

  it('TC-CI-ADM-01 required hours out of the range 1 to 2000 fail', async () => {
    for (const hours of [0, 2001]) {
      const ins = await admin
        .from('batches')
        .insert({ name: `L2 bad ${STAMP}`, start_date: '2027-02-01', end_date: '2027-03-01', required_hours: hours });
      expect(ins.error?.code).toBe('23514');
    }
  });
});

describe('TC-CI-ADM-01 admin_dashboard', () => {
  type Row = {
    ojt_id: string; ojt_name: string; ojt_status: string; company_id: string; company_name: string;
    batch_id: string; batch_name: string; facilitator_id: string; facilitator_name: string;
    required_hours: number; logged_minutes: number; late_reports: number; behind: boolean;
  };

  it('TC-CI-ADM-01 gives one row for each seed OJT with sane values', async () => {
    const { data, error } = await admin.rpc('admin_dashboard');
    expect(error).toBeNull();
    const rows = (data ?? []) as Row[];
    const ids = rows.map((r) => r.ojt_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([SEED.ojt1.id, SEED.ojt4.id, SEED.ojt6.id]));
    for (const r of rows) {
      expect(typeof r.ojt_name).toBe('string');
      expect(typeof r.facilitator_name).toBe('string');
      expect(typeof r.company_name).toBe('string');
      expect(typeof r.batch_name).toBe('string');
      expect(r.ojt_status).toBe('active');
      expect(r.required_hours).toBeGreaterThan(0);
      expect(r.logged_minutes).toBeGreaterThanOrEqual(0);
      expect(r.late_reports).toBeGreaterThanOrEqual(0);
      expect(typeof r.behind).toBe('boolean');
      if (r.late_reports > 0) expect(r.behind).toBe(true);
    }
    const ojt6 = rows.find((r) => r.ojt_id === SEED.ojt6.id)!;
    expect(ojt6.facilitator_id).toBe(SEED.fac2.id);
  });

  it('TC-CI-ADM-01 logged minutes agree with the pairing rule of hours.ts', async () => {
    const { data } = await admin.rpc('admin_dashboard');
    const row = ((data ?? []) as Row[]).find((r) => r.ojt_id === SEED.ojt4.id)!;
    const punches = await admin
      .from('punches')
      .select('id, type, device_time, corrects_punch_id')
      .eq('ojt_id', SEED.ojt4.id)
      .is('deleted_at', null)
      .limit(5000);
    const list = punches.data ?? [];
    const corrected = new Set(list.map((p) => p.corrects_punch_id).filter(Boolean));
    const sorted = list
      .filter((p) => !corrected.has(p.id))
      .sort((a, b) => Date.parse(a.device_time) - Date.parse(b.device_time) || (a.id < b.id ? -1 : 1));
    let open: number | null = null;
    let total = 0;
    for (const p of sorted) {
      const t = Date.parse(p.device_time);
      if (p.type === 'in') open = t;
      else if (open !== null) {
        total += Math.floor((t - open) / 60000);
        open = null;
      }
    }
    expect(row.logged_minutes).toBe(total);
  });

  it.each([
    ['OJT', SEED.ojt1.email],
    ['facilitator', SEED.fac1.email],
  ])('TC-CI-ADM-01 fails for a %s token', async (_role, email) => {
    const client = await signedIn(email);
    const { data, error } = await client.rpc('admin_dashboard');
    expect(error?.code).toBe('42501');
    expect(data).toBeNull();
    await client.auth.signOut();
  });

  it('TC-CI-ADM-01 fails for the anon key', async () => {
    const { error } = await newClient().rpc('admin_dashboard');
    expect(error).not.toBeNull();
  });
});
