import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SEED, signedIn } from './helpers';

// TC-CI-EXP-02 (FR-EXP-03, QR-CO-03), server part: the report summary of a batch for the admin CSV.
// The DTR summary CSV uses admin_dashboard() (TC-CI-ADM-01). The CSV text is tested in the frontend
// (csv.spec.ts). This test reads only; it makes no rows.
type Row = {
  ojt_id: string;
  ojt_name: string;
  company_name: string;
  facilitator_name: string;
  week_start: string;
  status: string;
  updated_at: string;
};

let admin: SupabaseClient;

beforeAll(async () => {
  admin = await signedIn(SEED.admin.email);
});

describe('TC-CI-EXP-02 admin_export_reports', () => {
  it('TC-CI-EXP-02 the admin gets one row for each report of the batch, in a stable order', async () => {
    const { data, error } = await admin.rpc('admin_export_reports', { p_batch_id: SEED.batch1 });
    expect(error).toBeNull();
    const rows = (data ?? []) as Row[];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(Object.keys(r).sort()).toEqual(
        ['company_name', 'facilitator_name', 'ojt_id', 'ojt_name', 'status', 'updated_at', 'week_start'],
      );
      expect(['draft', 'submitted', 'approved', 'returned']).toContain(r.status);
      expect(r.week_start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${r.week_start}T00:00:00Z`).getUTCDay()).toBe(1);
      expect(typeof r.ojt_name).toBe('string');
      expect(typeof r.company_name).toBe('string');
      expect(typeof r.facilitator_name).toBe('string');
    }
    const keys = rows.map((r) => `${r.ojt_name}|${r.week_start}`);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
    expect(new Set(rows.map((r) => `${r.ojt_id}|${r.week_start}`)).size).toBe(rows.length);
  });

  it('TC-CI-EXP-02 the rows agree with the reports table', async () => {
    const { data } = await admin.rpc('admin_export_reports', { p_batch_id: SEED.batch1 });
    const mine = ((data ?? []) as Row[]).filter((r) => r.ojt_id === SEED.ojt1.id);
    const ojt1 = await signedIn(SEED.ojt1.email);
    const own = await ojt1.from('weekly_reports').select('week_start, status').is('deleted_at', null).order('week_start');
    expect(own.error).toBeNull();
    expect(mine.map((r) => [r.week_start, r.status])).toEqual((own.data ?? []).map((r) => [r.week_start, r.status]));
  });

  it('TC-CI-EXP-02 an unknown batch gives zero rows', async () => {
    const { data, error } = await admin.rpc('admin_export_reports', { p_batch_id: '20000000-0000-4000-a000-0000000000ff' });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('TC-CI-EXP-02 a facilitator and an OJT are refused', async () => {
    for (const email of [SEED.fac1.email, SEED.ojt1.email]) {
      const client = await signedIn(email);
      const { error } = await client.rpc('admin_export_reports', { p_batch_id: SEED.batch1 });
      expect(error?.code).toBe('42501');
    }
  });
});
