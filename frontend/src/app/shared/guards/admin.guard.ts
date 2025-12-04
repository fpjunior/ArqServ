import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const user = this.authService.getCurrentUser();
    if (user && user.role === 'admin') {
      if (state.url === '/documentacoes-financeiras') {
        this.router.navigate(['/documentacoes-financeiras/municipality']);
        return false;
      }
      return true;
    }

    this.router.navigate(['/auth/login']);
    return false;
  }
}