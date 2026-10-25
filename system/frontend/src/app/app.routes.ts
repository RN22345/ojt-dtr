// Top-level routes. Each role group has a guard (system modules, section 6; frontend rules 2 and 7).
import { Routes } from '@angular/router';
import { groupGuard, loginGuard, startGuard } from './core/auth/auth.guards';

const placeholder = () => import('./shared/placeholder/placeholder.page').then((m) => m.PlaceholderPage);

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [startGuard], children: [] },
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'ojt',
    canMatch: [groupGuard('ojt')],
    loadChildren: () => import('./features/ojt/ojt.routes').then((m) => m.routes),
  },
  {
    path: 'facilitator',
    canMatch: [groupGuard('facilitator')],
    loadChildren: () => import('./features/facilitator/facilitator.routes').then((m) => m.routes),
  },
  {
    path: 'admin',
    canMatch: [groupGuard('admin')],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.routes),
  },
  { path: 'profile', canMatch: [groupGuard('shared')], loadComponent: placeholder, data: { pageKey: 'profile' } },
  {
    path: 'notifications',
    canMatch: [groupGuard('shared')],
    loadComponent: placeholder,
    data: { pageKey: 'notifications' },
  },
  {
    path: 'sync-issues',
    canMatch: [groupGuard('shared')],
    loadComponent: placeholder,
    data: { pageKey: 'syncIssues' },
  },
  // A blocked or unknown URL goes to the start page (TC-ST-ACC-01: a typed URL of another role is blocked).
  { path: '**', redirectTo: '' },
];
