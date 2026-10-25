import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { newClient, SEED, signedIn } from './helpers';

// TC-CI-ACL-03 (QR-SE-01): OJT and facilitator tokens cannot use the admin endpoints.
// The Edge Function part (admin-users, export-csv) runs when those functions exist (S3).
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
