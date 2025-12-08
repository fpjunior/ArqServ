import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const user = this.authService.getCurrentUser();
    console.log('🔐 [AdminGuard] Verificando acesso - Usuário:', user, 'URL:', state.url);
    
    if (user && user.role === 'admin') {
      console.log('✅ [AdminGuard] Usuário é admin, acesso permitido');
      return true;
    }

    console.log('❌ [AdminGuard] Acesso negado, redirecionando para login');
    this.router.navigate(['/auth/login']);
    return false;
  }
}