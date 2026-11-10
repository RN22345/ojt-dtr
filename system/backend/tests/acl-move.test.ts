// L2 test TC-CI-ACL-02 (QR-SE-01, FR-DTR-10): the facilitator scope after the admin moves an OJT.
// Seed: ojt5 goes to fac1. The test moves ojt5 to fac2, checks the scope, then puts the seed assignment back.
// NOTE: Each run leaves one inactive assignment of ojt5 (to fac2) on dev. Assignments cannot be deleted.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SEED, signedIn } from './helpers';

const OJT5 = '00000000-0000-4000-a000-000000000025';
const SEED_ASSIGNMENT = '30000000-0000-4000-a000-000000000025';

let fac1: SupabaseClient;
let fac2: SupabaseClient;
let admin: SupabaseClient;

beforeAll(async () => {
  [fac1, fac2, admin] = await Promise.all([SEED.fac1.email, SEED.fac2.email, SEED.admin.email].map((e) => signedIn(e)));
});

afterAll(async () => {
  await Promise.all([fac1, fac2, admin].map((c) => c?.auth.signOut({ scope: 'local' })));
});

async function canSeeOjt5(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.from('profiles').select('id').eq('id', OJT5);
  expect(error).toBeNull();
  return (data ?? []).length === 1;
}

describe('TC-CI-ACL-02 facilitator data scope after a move', () => {
  it('TC-CI-ACL-02: after the admin moves ojt5 to fac2, fac1 cannot read ojt5, and the pull tells fac1', async () => {
    expect(await canSeeOjt5(fac1)).toBe(true);
    expect(await canSeeOjt5(fac2)).toBe(false);
    const before = await fac1.rpc('sync_pull', { p_cursor: 0, p_epoch: null, p_limit: 500 });
    expect(before.error).toBeNull();
    let cursor = (before.data as { cursor: number }).cursor;
    for (let more = (before.data as { has_more: boolean }).has_more; more; ) {
      const next = await fac1.rpc('sync_pull', { p_cursor: cursor, p_epoch: null, p_limit: 500 });
      cursor = (next.data as { cursor: number }).cursor;
      more = (next.data as { has_more: boolean; records: unknown[] }).has_more && (next.data as { records: unknown[] }).records.length > 0;
    }

    const moved = randomUUID();
    try {
      const end = await admin.from('ojt_assignments').update({ active: false }).eq('id', SEED_ASSIGNMENT).select('id');
      expect(end.error).toBeNull();
      const add = await admin.from('ojt_assignments').insert({
        id: moved, ojt_id: OJT5, facilitator_id: SEED.fac2.id, company_id: SEED.companyA, batch_id: SEED.batch1,
      });
      expect(add.error).toBeNull();

      expect(await canSeeOjt5(fac1)).toBe(false);
      expect(await canSeeOjt5(fac2)).toBe(true);
      const punches = await fac1.from('punches').select('id').eq('ojt_id', OJT5);
      expect(punches.data).toEqual([]);

      // The pull gives fac1 the ended assignment, so the device can remove the records of ojt5.
      await new Promise((r) => setTimeout(r, 2500));
      const after = await fac1.rpc('sync_pull', { p_cursor: cursor, p_epoch: null, p_limit: 500 });
      const records = (after.data as { records: { entity: string; data: Record<string, unknown> }[] }).records;
      expect(records.find((r) => r.entity === 'ojt_assignments' && r.data['id'] === SEED_ASSIGNMENT)?.data['active']).toBe(false);
    } finally {
      await admin.from('ojt_assignments').update({ active: false }).eq('id', moved);
      await admin.from('ojt_assignments').update({ active: true }).eq('id', SEED_ASSIGNMENT);
    }
    expect(await canSeeOjt5(fac1)).toBe(true);
  });
});
