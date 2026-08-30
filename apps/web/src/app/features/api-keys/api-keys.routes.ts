import { Routes } from '@angular/router';

export const API_KEYS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/api-keys-page/api-keys-page').then((m) => m.ApiKeysPage),
  },
];
