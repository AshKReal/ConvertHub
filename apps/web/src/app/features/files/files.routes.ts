import { Routes } from '@angular/router';

export const FILES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/files-page/files-page').then((m) => m.FilesPage),
  },
];
