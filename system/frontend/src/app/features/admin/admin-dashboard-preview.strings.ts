export const ADMIN_DASHBOARD_PREVIEW = {
  statsLabel: 'Dashboard totals',
  stats: [
    { label: 'Active OJTs', value: 42, tone: 'default' },
    { label: 'Facilitators', value: 6, tone: 'default' },
    { label: 'Reports waiting', value: 11, tone: 'primary' },
    { label: 'Doubtful punches this week', value: 3, tone: 'warning' },
  ],
  keepAliveTitle: 'Keep-alive (source A, B, C)',
  keepAlive: [
    { label: 'github: 3 h ago', tone: 'success' },
    { label: 'cron service: 5 h ago', tone: 'success' },
    { label: 'backup: 6 days ago', tone: 'warning' },
  ],
  auditTitle: 'Recent audit entries',
  audit: {
    columns: ['Time', 'Actor', 'Action', 'Entity'],
    rows: [
      ['Oct 26, 09:14', 'Admin', 'update', 'companies'],
      ['Oct 26, 08:50', 'Admin', 'insert', 'ojt_assignments'],
      ['Oct 25, 16:02', 'Facilitator One', 'approve', 'weekly_reports'],
    ],
  },
} as const;
