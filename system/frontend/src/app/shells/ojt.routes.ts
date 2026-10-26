// OJT shell (mobile). Route group /ojt/* (system modules, section 6).
import { Routes } from '@angular/router';
import { shellRoutes } from '../shared/shell/shell-routes';

export const routes: Routes = shellRoutes([
  { path: 'home', pageKey: 'ojtHome', icon: 'home-outline' },
  { path: 'dtr', pageKey: 'ojtDtr', icon: 'time-outline', load: () => import('../features/dtr/dtr.page').then((m) => m.DtrPage) },
  { path: 'reports', pageKey: 'ojtReports', icon: 'document-text-outline' },
  { path: 'progress', pageKey: 'ojtProgress', icon: 'stats-chart-outline' },
]);
