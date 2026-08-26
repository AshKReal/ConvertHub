import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { findConversionDirection } from '@convert-hub/shared';

/** Незнакомое направление в адресе — не экран ошибки, а возврат на главную к списку направлений. */
const knownDirection: CanActivateFn = (route) => {
  const id = route.paramMap.get('direction');
  if (id !== null && findConversionDirection(id) !== undefined) {
    return true;
  }

  return inject(Router).parseUrl('/');
};

export const CONVERT_ROUTES: Routes = [
  {
    path: ':direction',
    canActivate: [knownDirection],
    loadComponent: () => import('./pages/convert-page/convert-page').then((m) => m.ConvertPage),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/',
  },
];
