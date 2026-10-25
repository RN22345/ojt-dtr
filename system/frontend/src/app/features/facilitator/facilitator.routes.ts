// Facilitator shell (mobile). Route group /facilitator/* (system modules, section 6).
import { Routes } from '@angular/router';
import { shellRoutes } from '../../shared/shell/shell-routes';

export const routes: Routes = shellRoutes([
  { path: 'ojts', pageKey: 'facOjts', icon: 'people-outline' },
  { path: 'reviews', pageKey: 'facReviews', icon: 'checkmark-done-outline' },
]);
