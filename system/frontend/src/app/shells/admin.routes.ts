// Admin shell (web). Route group /admin/* (system modules, section 6).
import { Routes } from '@angular/router';
import { shellRoutes } from '../shared/shell/shell-routes';

export const routes: Routes = shellRoutes(
  [
    { path: 'dashboard', pageKey: 'adminDashboard', load: () => import('../features/admin/dashboard.page').then((m) => m.AdminDashboardPage), icon: 'grid-outline' },
    { path: 'users', pageKey: 'adminUsers', load: () => import('../features/admin/users.page').then((m) => m.AdminUsersPage), icon: 'person-outline' },
    { path: 'companies', pageKey: 'adminCompanies', load: () => import('../features/admin/companies.page').then((m) => m.AdminCompaniesPage), icon: 'business-outline' },
    { path: 'batches', pageKey: 'adminBatches', load: () => import('../features/admin/batches.page').then((m) => m.AdminBatchesPage), icon: 'calendar-outline' },
    { path: 'assignments', pageKey: 'adminAssignments', load: () => import('../features/admin/assignments.page').then((m) => m.AdminAssignmentsPage), icon: 'link-outline' },
    { path: 'audit', pageKey: 'adminAudit', load: () => import('../features/admin/audit.page').then((m) => m.AdminAuditPage), icon: 'list-outline' },
  ],
  'top',
);
