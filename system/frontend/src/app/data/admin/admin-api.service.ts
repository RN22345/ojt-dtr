// The one path of the admin web app to the server (D-70). It is online only (D-13): there is no local database.
// Accounts use the Edge Function `admin-users`. Other data uses the Data API and the RPC `admin_dashboard()`.
import { Injectable, inject } from '@angular/core';
import { SUPABASE } from '../../core/supabase.client';
import {
  AdminError,
  AdminUser,
  Assignment,
  AssignmentInput,
  AuditEntry,
  AuditFilter,
  AuditPage,
  Batch,
  Company,
  DashboardRow,
  NewUserInput,
  UserChanges,
} from './admin-models';

export const AUDIT_PAGE_SIZE = 50;

type Row = Record<string, any>;
interface Result<T> {
  data: T | null;
  error: { code?: string; message?: string } | null;
  count?: number | null;
}

/** Gives the code of a failed Data API call. */
function dataErrorCode(error: { code?: string; message?: string }): string {
  if (error.code === '42501') {
    return 'forbidden';
  }
  if (error.code === '23505') {
    return 'duplicate';
  }
  if (error.code === '23514' || error.code === '22P02') {
    return 'invalid_data';
  }
  return /fetch|network|timeout|abort/i.test(error.message ?? '') ? 'network' : 'unknown';
}

function rows<T>(result: Result<T[]>): T[] {
  if (result.error) {
    throw new AdminError(dataErrorCode(result.error));
  }
  return result.data ?? [];
}

function done(result: Result<unknown>): void {
  if (result.error) {
    throw new AdminError(dataErrorCode(result.error));
  }
}

/** Gives the error code of a failed Edge Function call. The body has `{error: code}` (HTTP 400 or 403). */
async function functionErrorCode(error: unknown): Promise<string> {
  const context = (error as { context?: { json?: () => Promise<{ error?: unknown }> } }).context;
  if (typeof context?.json !== 'function') {
    return 'network';
  }
  try {
    const body = await context.json();
    return typeof body?.error === 'string' ? body.error : 'unknown';
  } catch {
    return 'unknown';
  }
}

const toUser = (r: Row): AdminUser => ({
  id: r['id'],
  role: r['role'],
  fullName: r['full_name'] ?? '',
  contactNo: r['contact_no'] ?? null,
  status: r['status'],
});
const toCompany = (r: Row): Company => ({
  id: r['id'],
  name: r['name'],
  address: r['address'] ?? '',
  photoRequired: !!r['photo_required'],
  locationRequired: !!r['location_required'],
});
const toBatch = (r: Row): Batch => ({
  id: r['id'],
  name: r['name'],
  startDate: r['start_date'],
  endDate: r['end_date'],
  requiredHours: r['required_hours'],
});
const toAssignment = (r: Row): Assignment => ({
  id: r['id'],
  ojtId: r['ojt_id'],
  facilitatorId: r['facilitator_id'],
  companyId: r['company_id'],
  batchId: r['batch_id'],
  active: !!r['active'],
});
const toDashboardRow = (r: Row): DashboardRow => ({
  ojtId: r['ojt_id'],
  ojtName: r['ojt_name'] ?? '',
  ojtStatus: r['ojt_status'] ?? '',
  companyId: r['company_id'],
  companyName: r['company_name'] ?? '',
  batchId: r['batch_id'],
  batchName: r['batch_name'] ?? '',
  facilitatorId: r['facilitator_id'],
  facilitatorName: r['facilitator_name'] ?? '',
  requiredHours: Number(r['required_hours']),
  loggedMinutes: Number(r['logged_minutes']),
  lateReports: Number(r['late_reports']),
  behind: !!r['behind'],
});
const toAudit = (r: Row): AuditEntry => ({
  id: r['id'],
  actorId: r['actor_id'] ?? null,
  action: r['action'],
  entity: r['entity'],
  entityId: r['entity_id'] ?? null,
  beforeData: r['before_data'] ?? null,
  afterData: r['after_data'] ?? null,
  createdAt: r['created_at'],
});

/** The start of a day in Asia/Manila (UTC+8, no daylight saving time) as an ISO instant. */
const dayStart = (date: string): string => `${date}T00:00:00+08:00`;
const dayEnd = (date: string): string => `${date}T23:59:59.999+08:00`;

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly db = inject(SUPABASE);

  // --- Accounts (FR-ADM-01) ---

  async createUser(input: NewUserInput): Promise<string> {
    const body = {
      action: 'create',
      email: input.email,
      password: input.password,
      full_name: input.fullName,
      role: input.role,
      ...(input.contactNo ? { contact_no: input.contactNo } : {}),
    };
    const result = await this.account(body);
    return String(result['user_id'] ?? '');
  }

  async updateUser(userId: string, changes: UserChanges): Promise<void> {
    await this.account({
      action: 'update',
      user_id: userId,
      full_name: changes.fullName,
      contact_no: changes.contactNo,
      role: changes.role,
    });
  }

  async setUserActive(userId: string, active: boolean): Promise<void> {
    await this.account({ action: active ? 'activate' : 'deactivate', user_id: userId });
  }

  async resetPassword(userId: string, password: string): Promise<void> {
    await this.account({ action: 'reset_password', user_id: userId, password });
  }

  private async account(body: Record<string, unknown>): Promise<Row> {
    const { data, error } = await this.db.functions.invoke('admin-users', { body });
    if (error) {
      throw new AdminError(await functionErrorCode(error));
    }
    if (data && typeof data.error === 'string') {
      throw new AdminError(data.error);
    }
    return data ?? {};
  }

  async listUsers(): Promise<AdminUser[]> {
    const result = (await this.db
      .from('profiles')
      .select('id, role, full_name, contact_no, status')
      .order('full_name')) as Result<Row[]>;
    return rows(result).map(toUser);
  }

  // --- Host companies (FR-ADM-02, FR-ADM-06) ---

  async listCompanies(): Promise<Company[]> {
    const result = (await this.db
      .from('companies')
      .select('id, name, address, photo_required, location_required')
      .is('deleted_at', null)
      .order('name')) as Result<Row[]>;
    return rows(result).map(toCompany);
  }

  async saveCompany(id: string | null, value: Omit<Company, 'id'>): Promise<void> {
    const record = {
      name: value.name,
      address: value.address,
      photo_required: value.photoRequired,
      location_required: value.locationRequired,
    };
    const table = this.db.from('companies');
    done((await (id ? table.update(record).eq('id', id) : table.insert(record))) as Result<unknown>);
  }

  // --- Batches (FR-ADM-03) ---

  async listBatches(): Promise<Batch[]> {
    const result = (await this.db
      .from('batches')
      .select('id, name, start_date, end_date, required_hours')
      .is('deleted_at', null)
      .order('start_date', { ascending: false })) as Result<Row[]>;
    return rows(result).map(toBatch);
  }

  async saveBatch(id: string | null, value: Omit<Batch, 'id'>): Promise<void> {
    const record = {
      name: value.name,
      start_date: value.startDate,
      end_date: value.endDate,
      required_hours: value.requiredHours,
    };
    const table = this.db.from('batches');
    done((await (id ? table.update(record).eq('id', id) : table.insert(record))) as Result<unknown>);
  }

  // --- Assignments (FR-ADM-04) ---

  async listAssignments(): Promise<Assignment[]> {
    const result = (await this.db
      .from('ojt_assignments')
      .select('id, ojt_id, facilitator_id, company_id, batch_id, active')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })) as Result<Row[]>;
    return rows(result).map(toAssignment);
  }

  /**
   * Assigns an OJT. If the OJT has an active assignment (`currentId`), this is a move: the old assignment
   * becomes not active, then the new one is added. If the add fails, the old one is active again.
   */
  async assign(input: AssignmentInput, currentId: string | null): Promise<void> {
    if (currentId) {
      await this.setAssignmentActive(currentId, false);
    }
    const insert = (await this.db.from('ojt_assignments').insert({
      ojt_id: input.ojtId,
      facilitator_id: input.facilitatorId,
      company_id: input.companyId,
      batch_id: input.batchId,
      active: true,
    })) as Result<unknown>;
    if (insert.error) {
      if (currentId) {
        await this.setAssignmentActive(currentId, true).catch(() => undefined);
      }
      throw new AdminError(dataErrorCode(insert.error));
    }
  }

  async setAssignmentActive(id: string, active: boolean): Promise<void> {
    done((await this.db.from('ojt_assignments').update({ active }).eq('id', id)) as Result<unknown>);
  }

  // --- Dashboard (FR-MON-03, FR-MON-04) ---

  async dashboard(): Promise<DashboardRow[]> {
    const result = (await this.db.rpc('admin_dashboard')) as Result<Row[]>;
    return rows(result).map(toDashboardRow);
  }

  // --- Audit log (FR-AUD-02) ---

  /** One page of the audit log, newest first. `page` starts at 0. */
  async auditPage(filter: AuditFilter, page: number): Promise<AuditPage> {
    let query = this.db
      .from('audit_logs')
      .select('id, actor_id, action, entity, entity_id, before_data, after_data, created_at', { count: 'exact' });
    if (filter.entity) {
      query = query.eq('entity', filter.entity);
    }
    if (filter.actorId) {
      query = query.eq('actor_id', filter.actorId);
    }
    if (filter.from) {
      query = query.gte('created_at', dayStart(filter.from));
    }
    if (filter.to) {
      query = query.lte('created_at', dayEnd(filter.to));
    }
    const result = (await query
      .order('created_at', { ascending: false })
      .range(page * AUDIT_PAGE_SIZE, (page + 1) * AUDIT_PAGE_SIZE - 1)) as Result<Row[]>;
    const list = rows(result).map(toAudit);
    return { rows: list, total: result.count ?? list.length };
  }
}
