import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/home/home.routes').then((m) => m.HOME_ROUTES),
  },
  {
    path: 'convert',
    loadChildren: () => import('./features/convert/convert.routes').then((m) => m.CONVERT_ROUTES),
  },
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadChildren: () => import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
  },
  {
    path: 'files',
    canActivate: [authGuard],
    loadChildren: () => import('./features/files/files.routes').then((m) => m.FILES_ROUTES),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
