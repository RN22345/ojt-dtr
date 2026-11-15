// Admin shell (web). Route group /admin/* (system modules, section 6).
import { Routes } from '@angular/router';
import { shellRoutes } from '../shared/shell/shell-routes';

const loadPreview = () => import('../features/admin/admin-preview.page').then((m) => m.AdminPreviewPage);

export const routes: Routes = shellRoutes(
  [
    { path: 'dashboard', pageKey: 'adminDashboard', icon: 'grid-outline', load: loadPreview },
    { path: 'users', pageKey: 'adminUsers', icon: 'person-outline', load: loadPreview },
    { path: 'companies', pageKey: 'adminCompanies', icon: 'business-outline', load: loadPreview },
    { path: 'batches', pageKey: 'adminBatches', icon: 'calendar-outline', load: loadPreview },
    { path: 'assignments', pageKey: 'adminAssignments', icon: 'link-outline', load: loadPreview },
    { path: 'audit', pageKey: 'adminAudit', icon: 'list-outline', load: loadPreview },
  ],
  'top',
);
