import { AdminError, AdminUser, AuditEntry } from '../../data/admin/admin-models';
import { ADM_STRINGS } from '../../shared/strings-adm';
import {
  EMPTY_ASSIGNMENT,
  EMPTY_BATCH,
  EMPTY_COMPANY,
  EMPTY_USER,
  activeAssignmentOf,
  changedFields,
  errorMessage,
  filterUsers,
  hasErrors,
  pageCount,
  validateAssignment,
  validateBatch,
  validateCompany,
  validatePassword,
  validateUser,
} from './admin-forms';

const GOOD_USER = { email: 'ana@plv.edu.ph', password: 'password1', fullName: 'Ana Cruz', contactNo: '0917 123 4567', role: 'ojt' as const };

describe('user form validation (FR-ADM-01)', () => {
  it('accepts a correct new user', () => {
    expect(hasErrors(validateUser(GOOD_USER, 'create'))).toBe(false);
  });

  it('rejects a bad e-mail address, a short password, and no role', () => {
    const errors = validateUser({ ...GOOD_USER, email: 'ana@', password: '1234567', role: '' }, 'create');
    expect(Object.keys(errors).sort()).toEqual(['email', 'password', 'role']);
  });

  it('does not examine the e-mail address and the password when it changes a user', () => {
    expect(hasErrors(validateUser({ ...EMPTY_USER, fullName: 'Ana', role: 'admin' }, 'edit'))).toBe(false);
  });

  it('rejects an empty or long name and a bad contact number', () => {
    expect(validateUser({ ...GOOD_USER, fullName: '  ' }, 'create').fullName).toBeDefined();
    expect(validateUser({ ...GOOD_USER, fullName: 'x'.repeat(201) }, 'create').fullName).toBeDefined();
    expect(validateUser({ ...GOOD_USER, contactNo: 'abc' }, 'create').contactNo).toBeDefined();
    expect(validateUser({ ...GOOD_USER, contactNo: '1'.repeat(21) }, 'create').contactNo).toBeDefined();
    expect(validateUser({ ...GOOD_USER, contactNo: '' }, 'create').contactNo).toBeUndefined();
  });

  it('needs 8 characters for a new password', () => {
    expect(validatePassword('1234567')).not.toBeNull();
    expect(validatePassword('12345678')).toBeNull();
  });
});

describe('company, batch, and assignment validation (FR-ADM-02 to FR-ADM-04)', () => {
  it('needs a company name and limits the lengths', () => {
    expect(validateCompany(EMPTY_COMPANY).name).toBeDefined();
    expect(validateCompany({ ...EMPTY_COMPANY, name: 'Acme', address: 'x'.repeat(501) }).address).toBeDefined();
    expect(hasErrors(validateCompany({ ...EMPTY_COMPANY, name: 'Acme', address: 'Manila' }))).toBe(false);
  });

  const batch = { name: 'Batch 1', startDate: '2026-11-02', endDate: '2027-02-27', requiredHours: '486' };

  it('accepts a correct batch', () => {
    expect(hasErrors(validateBatch(batch))).toBe(false);
  });

  it('accepts an end date that is the same as the start date', () => {
    expect(hasErrors(validateBatch({ ...batch, endDate: batch.startDate }))).toBe(false);
  });

  it('rejects an end date before the start date', () => {
    expect(validateBatch({ ...batch, endDate: '2026-11-01' }).endDate).toBe(ADM_STRINGS.fields.dateOrder);
  });

  it('rejects empty fields', () => {
    expect(Object.keys(validateBatch(EMPTY_BATCH)).sort()).toEqual(['endDate', 'name', 'requiredHours', 'startDate']);
  });

  it('accepts required hours from 1 to 2000 only, whole numbers', () => {
    for (const bad of ['0', '2001', '1.5', '-3', 'abc', '']) {
      expect(validateBatch({ ...batch, requiredHours: bad }).requiredHours, bad).toBeDefined();
    }
    for (const good of ['1', '2000']) {
      expect(validateBatch({ ...batch, requiredHours: good }).requiredHours, good).toBeUndefined();
    }
  });

  it('needs all four fields of an assignment and two different users', () => {
    expect(Object.keys(validateAssignment(EMPTY_ASSIGNMENT))).toHaveLength(4);
    const full = { ojtId: 'a', facilitatorId: 'b', companyId: 'c', batchId: 'd' };
    expect(hasErrors(validateAssignment(full))).toBe(false);
    expect(validateAssignment({ ...full, facilitatorId: 'a' }).facilitatorId).toBeDefined();
  });

  it('finds the active assignment of an OJT for a move', () => {
    const list = [
      { id: '1', ojtId: 'a', facilitatorId: 'f', companyId: 'c', batchId: 'b', active: false },
      { id: '2', ojtId: 'a', facilitatorId: 'f', companyId: 'c', batchId: 'b', active: true },
    ];
    expect(activeAssignmentOf(list, 'a')?.id).toBe('2');
    expect(activeAssignmentOf(list, 'z')).toBeNull();
  });
});

describe('list helpers and messages', () => {
  const users: AdminUser[] = [
    { id: '1', role: 'ojt', fullName: 'Ana Cruz', contactNo: null, status: 'active' },
    { id: '2', role: 'facilitator', fullName: 'Ben Reyes', contactNo: null, status: 'active' },
    { id: '3', role: 'ojt', fullName: 'Cara Cruz', contactNo: null, status: 'inactive' },
  ];

  it('searches by name and filters by role (FR-ADM-01)', () => {
    expect(filterUsers(users, '', '')).toHaveLength(3);
    expect(filterUsers(users, 'cruz', '').map((u) => u.id)).toEqual(['1', '3']);
    expect(filterUsers(users, '', 'facilitator').map((u) => u.id)).toEqual(['2']);
    expect(filterUsers(users, ' CARA ', 'ojt').map((u) => u.id)).toEqual(['3']);
  });

  it('gives a clear message for each error code of the Edge Function', () => {
    const codes = ['invalid_email', 'weak_password', 'invalid_role', 'email_taken', 'not_found', 'self_deactivate', 'forbidden'];
    const texts = codes.map((c) => errorMessage(new AdminError(c)));
    expect(new Set(texts).size).toBe(codes.length);
    for (const text of texts) {
      expect(text).not.toBe(ADM_STRINGS.errors['unknown']);
    }
    expect(errorMessage(new Error('x'))).toBe(ADM_STRINGS.errors['unknown']);
    expect(errorMessage(new AdminError('new_code'))).toBe(ADM_STRINGS.errors['unknown']);
  });

  it('names the changed fields of an audit entry (FR-AUD-02)', () => {
    const entry = (before: Record<string, unknown> | null, after: Record<string, unknown> | null): AuditEntry => ({
      id: '1', actorId: null, action: 'update', entity: 'batches', entityId: 'x',
      beforeData: before, afterData: after, createdAt: '2026-11-08T00:00:00Z',
    });
    expect(changedFields(entry({ name: 'A', hours: 1, version: 1 }, { name: 'B', hours: 1, version: 2 }))).toEqual(['name']);
    expect(changedFields(entry(null, { name: 'B' }))).toEqual([]);
  });

  it('counts the pages with a minimum of one', () => {
    expect(pageCount(0, 50)).toBe(1);
    expect(pageCount(50, 50)).toBe(1);
    expect(pageCount(51, 50)).toBe(2);
  });
});
