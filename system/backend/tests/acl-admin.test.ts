import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env, newClient, SEED, signedIn } from './helpers';

// TC-CI-ACL-03 (QR-SE-01): OJT and facilitator tokens cannot use the admin endpoints.
// The Edge Function part covers admin-users (S3). export-csv comes in S4.
const roles = [
  ['OJT', SEED.ojt1.email],
  ['facilitator', SEED.fac1.email],
] as const;

describe.each(roles)('TC-CI-ACL-03 admin endpoints with a %s token', (_role, email) => {
  let client: SupabaseClient;

  beforeAll(async () => {
    client = await signedIn(email);
  });
  afterAll(async () => {
    await client.auth.signOut();
  });

  it('TC-CI-ACL-03 cannot insert a company', async () => {
    const { error } = await client.from('companies').insert({ name: 'Forged company' });
    expect(error).not.toBeNull();
  });

  it('TC-CI-ACL-03 cannot change a company', async () => {
    const { data, error } = await client
      .from('companies')
      .update({ name: 'Forged name' })
      .eq('id', SEED.companyA)
      .select();
    // RLS gives an error or zero changed rows.
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it('TC-CI-ACL-03 cannot insert or change a batch', async () => {
    const ins = await client
      .from('batches')
      .insert({ name: 'Forged', start_date: '2026-01-05', end_date: '2026-02-05', required_hours: 1 });
    expect(ins.error).not.toBeNull();

    const upd = await client.from('batches').update({ required_hours: 1 }).eq('id', SEED.batch1).select();
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
  });

  it('TC-CI-ACL-03 cannot insert or change an assignment', async () => {
    const ins = await client.from('ojt_assignments').insert({
      ojt_id: SEED.ojt6.id,
      facilitator_id: SEED.fac1.id,
      company_id: SEED.companyA,
      batch_id: SEED.batch1,
    });
    expect(ins.error).not.toBeNull();

    const upd = await client
      .from('ojt_assignments')
      .update({ facilitator_id: SEED.fac1.id })
      .eq('ojt_id', SEED.ojt6.id)
      .select();
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
  });

  it('TC-CI-ACL-03 reads zero audit_logs rows', async () => {
    const { data, error } = await client.from('audit_logs').select('id').limit(5);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('TC-CI-ACL-03 cannot change its own role', async () => {
    const { data, error } = await client
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', (await client.auth.getUser()).data.user!.id)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});

describe.each(roles)('TC-CI-ACL-03 Edge Function admin-users with a %s token', (_role, email) => {
  it('TC-CI-ACL-03 gets 403 for each action, and no account is made', async () => {
    const client = await signedIn(email);
    const token = (await client.auth.getSession()).data.session!.access_token;
    const call = (body: unknown) =>
      fetch(`${env('SUPABASE_URL')}/functions/v1/admin-users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, apikey: env('SUPABASE_ANON_KEY'), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const bodies = [
      { action: 'create', email: 'acl-forged@example.test', password: 'Forged-pass-1', full_name: 'Forged', role: 'admin' },
      { action: 'update', user_id: SEED.ojt1.id, role: 'admin' },
      { action: 'deactivate', user_id: SEED.ojt6.id },
      { action: 'reset_password', user_id: SEED.ojt6.id, password: 'Forged-pass-1' },
    ];
    for (const body of bodies) {
      const res = await call(body);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'forbidden' });
    }
    await client.auth.signOut();
  });
});

describe('TC-CI-ACL-03 Edge Function admin-users without a user token', () => {
  it('TC-CI-ACL-03 gets 401 or 403 with the anon key', async () => {
    const res = await fetch(`${env('SUPABASE_URL')}/functions/v1/admin-users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('SUPABASE_ANON_KEY')}`, apikey: env('SUPABASE_ANON_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deactivate', user_id: SEED.ojt6.id }),
    });
    expect([401, 403]).toContain(res.status);
  });
});

describe('TC-CI-ACL-03 control: the admin token can use the admin endpoints', () => {
  it('TC-CI-ACL-03 admin reads audit_logs and changes a company', async () => {
    const admin = await signedIn(SEED.admin.email);
    const audit = await admin.from('audit_logs').select('id').limit(1);
    expect(audit.error).toBeNull();
    expect((audit.data ?? []).length).toBe(1);

    // A no-op change: the same address. It proves that the admin policy permits the update.
    const company = await admin.from('companies').select('address').eq('id', SEED.companyA).single();
    const upd = await admin
      .from('companies')
      .update({ address: company.data!.address })
      .eq('id', SEED.companyA)
      .select();
    expect(upd.error).toBeNull();
    expect(upd.data).toHaveLength(1);
    await admin.auth.signOut();
  });

  it('TC-CI-ACL-03 admin reads all profiles, batches, and assignments', async () => {
    const admin = await signedIn(SEED.admin.email);
    const profiles = await admin.from('profiles').select('id');
    expect(profiles.error).toBeNull();
    expect((profiles.data ?? []).map((r) => r.id)).toEqual(
      expect.arrayContaining([SEED.admin.id, SEED.fac1.id, SEED.fac2.id, SEED.ojt1.id, SEED.ojt6.id]),
    );

    const batches = await admin.from('batches').select('id').eq('id', SEED.batch1);
    expect(batches.data).toEqual([{ id: SEED.batch1 }]);

    const assignments = await admin.from('ojt_assignments').select('ojt_id').in('ojt_id', [SEED.ojt1.id, SEED.ojt6.id]);
    expect((assignments.data ?? []).map((r) => r.ojt_id).sort()).toEqual([SEED.ojt1.id, SEED.ojt6.id].sort());
    await admin.auth.signOut();
  });
});

describe('TC-CI-ADM-01 assignment rules (database part, QR-SE-05)', () => {
  it('TC-CI-ADM-01 an assignment must link an OJT account to a facilitator account', async () => {
    const admin = await signedIn(SEED.admin.email);
    const base = { company_id: SEED.companyA, batch_id: SEED.batch1 };

    const notOjt = await admin.from('ojt_assignments').insert({ ...base, ojt_id: SEED.fac2.id, facilitator_id: SEED.fac1.id });
    expect(notOjt.error?.message).toContain('ojt_id must be an OJT account');

    const notFacilitator = await admin.from('ojt_assignments').insert({ ...base, ojt_id: SEED.ojt6.id, facilitator_id: SEED.ojt4.id });
    expect(notFacilitator.error?.message).toContain('facilitator_id must be a facilitator account');
    await admin.auth.signOut();
  });
});

describe('TC-CI-AUD-01 audit entries (admin data part, FR-AUD-01)', () => {
  it('TC-CI-AUD-01 a change of a company makes an audit entry with the actor and the before and after data', async () => {
    const admin = await signedIn(SEED.admin.email);
    const company = await admin.from('companies').select('address, version').eq('id', SEED.companyA).single();
    const upd = await admin.from('companies').update({ address: company.data!.address }).eq('id', SEED.companyA).select('version');
    expect(upd.error).toBeNull();

    const { data, error } = await admin
      .from('audit_logs')
      .select('actor_id, action, entity, before_data, after_data')
      .eq('entity', 'companies')
      .eq('entity_id', SEED.companyA)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ actor_id: SEED.admin.id, action: 'update', entity: 'companies' });
    expect(data!.before_data['version']).toBe(company.data!.version);
    expect(data!.after_data['version']).toBe(upd.data![0].version);
    await admin.auth.signOut();
  });
});

describe('TC-CI-ACL-03 anonymous calls', () => {
  it('TC-CI-ACL-03 the anon key reads zero rows and cannot write', async () => {
    const anon = newClient();
    const read = await anon.from('profiles').select('id').limit(1);
    expect(read.error !== null || (read.data ?? []).length === 0).toBe(true);
    const write = await anon.from('companies').insert({ name: 'Anon company' });
    expect(write.error).not.toBeNull();
  });
});
