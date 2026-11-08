// Form models, validation, list helpers, and error text of the admin pages (FR-ADM-01 to FR-ADM-04, FR-AUD-02).
// All functions are pure. The rules follow the database checks (core schema) and the Edge Function `admin-users`.
import { AdminError, AdminRole, AdminUser, Assignment, AssignmentInput, AuditEntry } from '../../data/admin/admin-models';
import { ADM_STRINGS } from '../../shared/strings-adm';

const F = ADM_STRINGS.fields;

/** The error text of each field. A field without an error is not in the object. */
export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT = /^[0-9+() -]{0,20}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ROLES: AdminRole[] = ['ojt', 'facilitator', 'admin'];

export function errorMessage(error: unknown): string {
  const code = error instanceof AdminError ? error.code : 'unknown';
  return ADM_STRINGS.errors[code] ?? ADM_STRINGS.errors['unknown'];
}

// --- Users ---

export interface UserForm {
  email: string;
  password: string;
  fullName: string;
  contactNo: string;
  role: AdminRole | '';
}

export const EMPTY_USER: UserForm = { email: '', password: '', fullName: '', contactNo: '', role: '' };

/** `create` checks the e-mail address and the password. `edit` does not. */
export function validateUser(form: UserForm, mode: 'create' | 'edit'): FieldErrors<keyof UserForm> {
  const errors: FieldErrors<keyof UserForm> = {};
  if (mode === 'create' && !EMAIL.test(form.email.trim())) {
    errors.email = F.email;
  }
  if (mode === 'create' && form.password.length < 8) {
    errors.password = F.password;
  }
  const name = form.fullName.trim();
  if (!name) {
    errors.fullName = F.required;
  } else if (name.length > 200) {
    errors.fullName = F.nameLong;
  }
  if (!CONTACT.test(form.contactNo.trim())) {
    errors.contactNo = F.contact;
  }
  if (!ROLES.includes(form.role as AdminRole)) {
    errors.role = F.required;
  }
  return errors;
}

export function validatePassword(password: string): string | null {
  return password.length >= 8 ? null : F.password;
}

// --- Companies ---

export interface CompanyForm {
  name: string;
  address: string;
  photoRequired: boolean;
  locationRequired: boolean;
}

export const EMPTY_COMPANY: CompanyForm = { name: '', address: '', photoRequired: false, locationRequired: false };

export function validateCompany(form: CompanyForm): FieldErrors<'name' | 'address'> {
  const errors: FieldErrors<'name' | 'address'> = {};
  const name = form.name.trim();
  if (!name) {
    errors.name = F.required;
  } else if (name.length > 200) {
    errors.name = F.nameLong;
  }
  if (form.address.trim().length > 500) {
    errors.address = F.addressLong;
  }
  return errors;
}

// --- Batches ---

export interface BatchForm {
  name: string;
  startDate: string;
  endDate: string;
  requiredHours: string;
}

export const EMPTY_BATCH: BatchForm = { name: '', startDate: '', endDate: '', requiredHours: '' };

function batchDateErrors(form: BatchForm): FieldErrors<'startDate' | 'endDate'> {
  const errors: FieldErrors<'startDate' | 'endDate'> = {};
  if (!DATE.test(form.startDate)) {
    errors.startDate = F.required;
  }
  if (!DATE.test(form.endDate)) {
    errors.endDate = F.required;
  } else if (DATE.test(form.startDate) && form.endDate < form.startDate) {
    errors.endDate = F.dateOrder;
  }
  return errors;
}

export function validateBatch(form: BatchForm): FieldErrors<keyof BatchForm> {
  const errors: FieldErrors<keyof BatchForm> = batchDateErrors(form);
  const name = form.name.trim();
  if (!name) {
    errors.name = F.required;
  } else if (name.length > 100) {
    errors.name = F.nameLong;
  }
  const hours = Number(form.requiredHours);
  if (!/^\d+$/.test(form.requiredHours.trim()) || hours < 1 || hours > 2000) {
    errors.requiredHours = F.hours;
  }
  return errors;
}

// --- Assignments ---

export type AssignmentForm = { [K in keyof AssignmentInput]: string };

export const EMPTY_ASSIGNMENT: AssignmentForm = { ojtId: '', facilitatorId: '', companyId: '', batchId: '' };

export function validateAssignment(form: AssignmentForm): FieldErrors<keyof AssignmentForm> {
  const errors: FieldErrors<keyof AssignmentForm> = {};
  for (const key of Object.keys(EMPTY_ASSIGNMENT) as (keyof AssignmentForm)[]) {
    if (!form[key]) {
      errors[key] = F.required;
    }
  }
  if (form.ojtId && form.ojtId === form.facilitatorId) {
    errors.facilitatorId = F.sameUser;
  }
  return errors;
}

/** The active assignment of an OJT, or null. A move replaces this assignment. */
export function activeAssignmentOf(list: Assignment[], ojtId: string): Assignment | null {
  return list.find((a) => a.ojtId === ojtId && a.active) ?? null;
}

// --- Lists ---

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

/** Search by name (not case sensitive) and filter by role. An empty `role` means all roles. */
export function filterUsers(users: AdminUser[], search: string, role: AdminRole | ''): AdminUser[] {
  const text = search.trim().toLowerCase();
  return users.filter((u) => (!role || u.role === role) && (!text || u.fullName.toLowerCase().includes(text)));
}

/** The names of the fields that differ between the old and the new record of an audit entry. */
export function changedFields(entry: AuditEntry): string[] {
  const before = entry.beforeData ?? {};
  const after = entry.afterData ?? {};
  if (!entry.beforeData || !entry.afterData) {
    return [];
  }
  const skip = new Set(['updated_at', 'version', 'change_seq']);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => !skip.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .sort();
}

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}
