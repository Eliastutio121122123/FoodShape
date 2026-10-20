import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppRole, AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready();
  return auth.isAuthenticated() || router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const roleGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready();
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  const expectedRole = (route.data['role'] as AppRole | undefined) ?? route.paramMap.get('role');
  if (expectedRole && auth.currentRole() !== expectedRole) {
    return router.createUrlTree([`/app/${auth.currentRole()}`]);
  }
  return true;
};
