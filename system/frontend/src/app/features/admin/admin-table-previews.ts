import type { AdminTablePreview } from './admin-preview-table.component';

type PreviewPage = 'adminUsers' | 'adminCompanies' | 'adminBatches' | 'adminAssignments' | 'adminAudit';

interface AdminPreview {
  description: string;
  actions: readonly { label: string; tone?: 'outline' }[];
  table: AdminTablePreview;
}

/** Sample content from the admin design previews. */
export const ADMIN_TABLE_PREVIEWS = {
  adminUsers: {
    description: 'FR-ADM-01, FR-ADM-05 (CSV import), FR-AUTH-07 (password reset)',
    actions: [{ label: 'Import CSV', tone: 'outline' }, { label: 'Add user' }],
    table: {
      columns: ['Name', 'Email', 'Role', 'Status', 'Actions'],
      rows: [
        ['Maria Santos', 'maria.santos@school.example', { text: 'OJT', tone: 'warning' }, { text: 'Active', tone: 'success' }, 'Edit · Reset password'],
        ['Juan Dela Cruz', 'juan.dc@school.example', { text: 'OJT', tone: 'warning' }, { text: 'Active', tone: 'success' }, 'Edit · Reset password'],
        ['Facilitator One', 'fac1@company.example', { text: 'Facilitator', tone: 'warning' }, { text: 'Active', tone: 'success' }, 'Edit · Reset password'],
        ['Old Account', 'old@school.example', { text: 'OJT', tone: 'warning' }, { text: 'Inactive', tone: 'danger' }, 'Edit · Reset password'],
      ],
    },
  },
  adminCompanies: {
    description: 'FR-ADM-02: company settings (photo and location for a punch)',
    actions: [{ label: 'Add Company' }],
    table: {
      columns: ['Name', 'Address', 'Photo required', 'Location required'],
      rows: [
        ['Company A', 'Quezon City', 'No', 'No'],
        ['Company B', 'Makati City', 'Yes', 'Yes'],
        ['Company C', 'Pasig City', 'No', 'Yes'],
      ],
    },
  },
  adminBatches: {
    description: 'FR-ADM-03',
    actions: [{ label: 'Add Batch' }],
    table: {
      columns: ['Name', 'Start date', 'End date', 'Required hours'],
      rows: [
        ['Batch 2026-1', 'Oct 5, 2026', 'Feb 12, 2027', '486'],
        ['Batch 2025-2', 'Jun 2, 2025', 'Oct 10, 2025', '486'],
      ],
    },
  },
  adminAssignments: {
    description: 'FR-ADM-04: one active assignment for each OJT',
    actions: [{ label: 'New assignment' }],
    table: {
      columns: ['OJT', 'Facilitator', 'Company', 'Batch', 'Active'],
      rows: [
        ['Maria Santos', 'Facilitator One', 'Company A', 'Batch 2026-1', { text: 'Yes', tone: 'success' }],
        ['Juan Dela Cruz', 'Facilitator One', 'Company A', 'Batch 2026-1', { text: 'Yes', tone: 'success' }],
        ['Ana Reyes', 'Facilitator Two', 'Company B', 'Batch 2026-1', { text: 'Yes', tone: 'success' }],
      ],
    },
  },
  adminAudit: {
    description: 'FR-AUD-02: read-only, nobody can change an entry (QR-SE-07)',
    actions: [{ label: 'Export CSV', tone: 'outline' }],
    table: {
      columns: ['Time', 'Actor', 'Action', 'Entity', 'Change'],
      rows: [
        ['Oct 26, 09:14', 'Admin', 'update', 'companies', 'address: "Quezon" → "Quezon City"'],
        ['Oct 26, 08:50', 'Admin', 'insert', 'ojt_assignments', 'ojt: Maria Santos'],
        ['Oct 25, 16:02', 'Facilitator One', 'approve', 'weekly_reports', 'week: Oct 12'],
        ['Oct 25, 10:30', 'Admin', 'update', 'profiles', 'status: active → inactive'],
      ],
    },
  },
} as const satisfies Record<PreviewPage, AdminPreview>;
