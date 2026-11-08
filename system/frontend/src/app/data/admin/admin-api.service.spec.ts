import { TestBed } from '@angular/core/testing';
import { SUPABASE } from '../../core/supabase.client';
import { AUDIT_PAGE_SIZE, AdminApi } from './admin-api.service';
import { AdminError } from './admin-models';

interface Call {
  table: string;
  ops: [string, unknown[]][];
}
type Reply = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number };

/** A fake client. Each table call records its chain and gives the next reply of the table. */
function fakeClient(replies: Record<string, Reply[]> = {}, invoke?: (name: string, opts: unknown) => unknown) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, ops: [] };
    calls.push(call);
    const reply = () => ({ data: [], error: null, ...(replies[table]?.shift() ?? {}) });
    const chain: object = new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === 'then') {
            return (resolve: (value: unknown) => void) => resolve(reply());
          }
          return (...args: unknown[]) => {
            call.ops.push([prop, args]);
            return chain;
          };
        },
      },
    );
    return chain;
  };
  const rpc = vi.fn(async () => ({ data: replies['rpc']?.[0]?.data ?? [], error: null }));
  const functions = { invoke: vi.fn(async (name: string, opts: unknown) => invoke?.(name, opts) ?? { data: {}, error: null }) };
  return { client: { from, rpc, functions }, calls, rpc, functions };
}

function setup(fake: ReturnType<typeof fakeClient>): AdminApi {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: SUPABASE, useValue: fake.client }] });
  return TestBed.inject(AdminApi);
}

const ops = (call: Call, name: string) => call.ops.filter(([op]) => op === name).map(([, args]) => args);

describe('AdminApi accounts (FR-ADM-01, D-70)', () => {
  it('creates a user with the Edge Function and gives the user ID', async () => {
    const fake = fakeClient({}, () => ({ data: { user_id: 'u9' }, error: null }));
    const id = await setup(fake).createUser({
      email: 'a@b.ph',
      password: 'password1',
      fullName: 'Ana Cruz',
      role: 'ojt',
      contactNo: '',
    });
    expect(id).toBe('u9');
    expect(fake.functions.invoke).toHaveBeenCalledWith('admin-users', {
      body: { action: 'create', email: 'a@b.ph', password: 'password1', full_name: 'Ana Cruz', role: 'ojt' },
    });
  });

  it('sends the contact number only when it is not empty', async () => {
    const fake = fakeClient();
    await setup(fake).createUser({ email: 'a@b.ph', password: 'password1', fullName: 'A', role: 'admin', contactNo: '0917' });
    expect(fake.functions.invoke.mock.calls[0][1]).toMatchObject({ body: { contact_no: '0917' } });
  });

  it('maps the other account actions to the contract', async () => {
    const fake = fakeClient();
    const api = setup(fake);
    await api.updateUser('u1', { fullName: 'B', contactNo: '1', role: 'facilitator' });
    await api.setUserActive('u1', false);
    await api.setUserActive('u1', true);
    await api.resetPassword('u1', 'newpassword');
    const bodies = fake.functions.invoke.mock.calls.map((c) => (c[1] as { body: object }).body);
    expect(bodies).toEqual([
      { action: 'update', user_id: 'u1', full_name: 'B', contact_no: '1', role: 'facilitator' },
      { action: 'deactivate', user_id: 'u1' },
      { action: 'activate', user_id: 'u1' },
      { action: 'reset_password', user_id: 'u1', password: 'newpassword' },
    ]);
  });

  it('reads the error code from the body of an HTTP 400 response', async () => {
    const context = { json: async () => ({ error: 'email_taken' }) };
    const fake = fakeClient({}, () => ({ data: null, error: { context } }));
    await expect(setup(fake).setUserActive('u1', false)).rejects.toMatchObject({ code: 'email_taken' });
  });

  it('gives the code "network" when the call does not reach the server', async () => {
    const fake = fakeClient({}, () => ({ data: null, error: { context: new TypeError('Failed to fetch') } }));
    const error = await setup(fake)
      .resetPassword('u1', 'password1')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdminError);
    expect((error as AdminError).code).toBe('network');
  });

  it('lists users from profiles', async () => {
    const fake = fakeClient({
      profiles: [{ data: [{ id: 'u1', role: 'ojt', full_name: 'Ana', contact_no: null, status: 'active' }] }],
    });
    expect(await setup(fake).listUsers()).toEqual([
      { id: 'u1', role: 'ojt', fullName: 'Ana', contactNo: null, status: 'active' },
    ]);
  });
});

describe('AdminApi data (FR-ADM-02 to FR-ADM-04, FR-ADM-06)', () => {
  it('inserts a company and updates an existing company with the settings', async () => {
    const fake = fakeClient();
    const api = setup(fake);
    const value = { name: 'Acme', address: 'Manila', photoRequired: true, locationRequired: false };
    await api.saveCompany(null, value);
    await api.saveCompany('c1', value);
    const record = { name: 'Acme', address: 'Manila', photo_required: true, location_required: false };
    expect(ops(fake.calls[0], 'insert')).toEqual([[record]]);
    expect(ops(fake.calls[1], 'update')).toEqual([[record]]);
    expect(ops(fake.calls[1], 'eq')).toEqual([['id', 'c1']]);
  });

  it('lists only companies that are not deleted', async () => {
    const fake = fakeClient({ companies: [{ data: [] }] });
    await setup(fake).listCompanies();
    expect(ops(fake.calls[0], 'is')).toEqual([['deleted_at', null]]);
  });

  it('saves a batch with the column names of the database', async () => {
    const fake = fakeClient();
    await setup(fake).saveBatch(null, { name: 'B1', startDate: '2026-11-01', endDate: '2027-02-01', requiredHours: 486 });
    expect(ops(fake.calls[0], 'insert')).toEqual([
      [{ name: 'B1', start_date: '2026-11-01', end_date: '2027-02-01', required_hours: 486 }],
    ]);
  });

  it('gives "invalid_data" for a check violation', async () => {
    const fake = fakeClient({ batches: [{ error: { code: '23514', message: 'check' } }] });
    await expect(
      setup(fake).saveBatch(null, { name: 'B', startDate: '2026-11-02', endDate: '2026-11-01', requiredHours: 1 }),
    ).rejects.toMatchObject({ code: 'invalid_data' });
  });

  it('assigns an OJT with no move when there is no active assignment', async () => {
    const fake = fakeClient();
    await setup(fake).assign({ ojtId: 'o', facilitatorId: 'f', companyId: 'c', batchId: 'b' }, null);
    expect(fake.calls).toHaveLength(1);
    expect(ops(fake.calls[0], 'insert')).toEqual([
      [{ ojt_id: 'o', facilitator_id: 'f', company_id: 'c', batch_id: 'b', active: true }],
    ]);
  });

  it('moves an OJT: the old assignment becomes not active before the new one is added', async () => {
    const fake = fakeClient();
    await setup(fake).assign({ ojtId: 'o', facilitatorId: 'f', companyId: 'c', batchId: 'b' }, 'old');
    expect(fake.calls.map((c) => c.ops[0][0])).toEqual(['update', 'insert']);
    expect(ops(fake.calls[0], 'update')).toEqual([[{ active: false }]]);
    expect(ops(fake.calls[0], 'eq')).toEqual([['id', 'old']]);
  });

  it('makes the old assignment active again when the insert of a move fails', async () => {
    const fake = fakeClient({ ojt_assignments: [{}, { error: { code: '23505' } }] });
    await expect(
      setup(fake).assign({ ojtId: 'o', facilitatorId: 'f', companyId: 'c', batchId: 'b' }, 'old'),
    ).rejects.toMatchObject({ code: 'duplicate' });
    expect(fake.calls).toHaveLength(3);
    expect(ops(fake.calls[2], 'update')).toEqual([[{ active: true }]]);
  });

  it('gives the dashboard rows with numbers (FR-MON-03)', async () => {
    const fake = fakeClient({
      rpc: [
        {
          data: [
            {
              ojt_id: 'o1', ojt_name: 'Ana', ojt_status: 'active', company_id: 'c1', company_name: 'Acme',
              batch_id: 'b1', batch_name: 'B1', facilitator_id: 'f1', facilitator_name: 'Fe',
              required_hours: 486, logged_minutes: 600, late_reports: 2, behind: true,
            },
          ],
        },
      ],
    });
    const rows = await setup(fake).dashboard();
    expect(fake.rpc).toHaveBeenCalledWith('admin_dashboard');
    expect(rows[0]).toMatchObject({ ojtId: 'o1', loggedMinutes: 600, lateReports: 2, behind: true, requiredHours: 486 });
  });
});

describe('AdminApi audit log (FR-AUD-02)', () => {
  it('asks for 50 rows, newest first, with all filters', async () => {
    const fake = fakeClient({ audit_logs: [{ data: [], count: 120 }] });
    const page = await setup(fake).auditPage({ entity: 'batches', actorId: 'a1', from: '2026-11-01', to: '2026-11-02' }, 2);
    const call = fake.calls[0];
    expect(AUDIT_PAGE_SIZE).toBe(50);
    expect(ops(call, 'eq')).toEqual([['entity', 'batches'], ['actor_id', 'a1']]);
    expect(ops(call, 'gte')).toEqual([['created_at', '2026-11-01T00:00:00+08:00']]);
    expect(ops(call, 'lte')).toEqual([['created_at', '2026-11-02T23:59:59.999+08:00']]);
    expect(ops(call, 'order')).toEqual([['created_at', { ascending: false }]]);
    expect(ops(call, 'range')).toEqual([[100, 149]]);
    expect(page.total).toBe(120);
  });

  it('adds no filter call for empty filters', async () => {
    const fake = fakeClient();
    await setup(fake).auditPage({ entity: '', actorId: '', from: '', to: '' }, 0);
    expect(ops(fake.calls[0], 'eq')).toEqual([]);
    expect(ops(fake.calls[0], 'range')).toEqual([[0, 49]]);
  });
});
