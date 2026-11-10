// Typed models of the admin web app (D-70). The admin app reads the server only (D-13).
export type AdminRole = 'ojt' | 'facilitator' | 'admin';

export interface AdminUser {
  id: string;
  role: AdminRole;
  fullName: string;
  contactNo: string | null;
  status: 'active' | 'inactive';
}

export interface Company {
  id: string;
  name: string;
  address: string;
  photoRequired: boolean;
  locationRequired: boolean;
}

export interface Batch {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  requiredHours: number;
}

export interface Assignment {
  id: string;
  ojtId: string;
  facilitatorId: string;
  companyId: string;
  batchId: string;
  active: boolean;
}

export interface AssignmentInput {
  ojtId: string;
  facilitatorId: string;
  companyId: string;
  batchId: string;
}

/** One row of the RPC `admin_dashboard()`: one row for each active assignment. */
export interface DashboardRow {
  ojtId: string;
  ojtName: string;
  ojtStatus: string;
  companyId: string;
  companyName: string;
  batchId: string;
  batchName: string;
  facilitatorId: string;
  facilitatorName: string;
  requiredHours: number;
  loggedMinutes: number;
  lateReports: number;
  behind: boolean;
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditFilter {
  entity: string;
  actorId: string;
  /** First day (YYYY-MM-DD, Asia/Manila). Empty: no limit. */
  from: string;
  /** Last day (YYYY-MM-DD, Asia/Manila). Empty: no limit. */
  to: string;
}

export interface AuditPage {
  rows: AuditEntry[];
  total: number;
}

export interface NewUserInput {
  email: string;
  password: string;
  fullName: string;
  role: AdminRole;
  contactNo: string;
}

export interface UserChanges {
  fullName: string;
  contactNo: string;
  role: AdminRole;
}

/** An error of the admin API. `code` is a code of the Edge Function, or `network`, `forbidden`, `duplicate`, `invalid_data`, `unknown`. */
export class AdminError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
