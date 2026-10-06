import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoading()) {
    if (authService.isAuthenticated() && authService.isAdmin()) {
      return true;
    }
    return router.createUrlTree(['/dashboard']);
  }

  return toObservable(authService.isLoading).pipe(
    filter(loading => !loading),
    take(1),
    map(() => {
      if (authService.isAuthenticated() && authService.isAdmin()) {
        return true;
      }
      return router.createUrlTree(['/dashboard']);
    })
  );
};
