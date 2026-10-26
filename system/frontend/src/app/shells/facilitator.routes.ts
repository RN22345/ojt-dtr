// Facilitator shell (mobile). Route group /facilitator/* (system modules, section 6).
import { Routes } from '@angular/router';
import { shellRoutes } from '../shared/shell/shell-routes';

export const routes: Routes = shellRoutes(
  [
    {
      path: 'ojts',
      pageKey: 'facOjts',
      icon: 'people-outline',
      load: () => import('../features/dtr/my-ojts.page').then((m) => m.MyOjtsPage),
    },
    { path: 'reviews', pageKey: 'facReviews', icon: 'checkmark-done-outline' },
  ],
  'bottom',
  [{ path: 'ojts/:ojtId', loadComponent: () => import('../features/dtr/ojt-dtr.page').then((m) => m.OjtDtrPage) }],
);
