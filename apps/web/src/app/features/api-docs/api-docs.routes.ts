import { Routes } from '@angular/router';

export const API_DOCS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/api-docs-page/api-docs-page').then((m) => m.ApiDocsPage),
  },
];
