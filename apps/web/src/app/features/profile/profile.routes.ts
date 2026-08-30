import { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/profile-page/profile-page').then((m) => m.ProfilePage),
  },
];
