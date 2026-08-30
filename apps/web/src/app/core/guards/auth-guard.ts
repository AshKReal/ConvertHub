import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth';

/** Первый маршрут, которому есть смысл защищать (019 сознательно отложил guard до этого момента). */
export const authGuard: CanActivateFn = () => {
  if (inject(AuthService).user() !== null) {
    return true;
  }

  return inject(Router).parseUrl('/login');
};
