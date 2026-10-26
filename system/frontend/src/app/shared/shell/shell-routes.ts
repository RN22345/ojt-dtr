// Makes the child routes of a role shell. A tab opens its feature page, or a wireframe page until the feature exists.
import { Routes } from '@angular/router';
import { ShellTab } from './tab-shell.page';

export function shellRoutes(tabs: ShellTab[], slot: 'bottom' | 'top' = 'bottom'): Routes {
  return [
    {
      path: '',
      loadComponent: () => import('./tab-shell.page').then((m) => m.TabShellPage),
      data: { tabs, slot },
      children: [
        ...tabs.map((tab) => ({
          path: tab.path,
          loadComponent: tab.load ?? (() => import('../placeholder/placeholder.page').then((m) => m.PlaceholderPage)),
          data: { pageKey: tab.pageKey },
        })),
        { path: '', pathMatch: 'full' as const, redirectTo: tabs[0].path },
      ],
    },
  ];
}
