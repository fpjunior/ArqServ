import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class FinancialDocumentsGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const user = this.authService.getCurrentUser();
    console.log('🔐 [FinancialDocumentsGuard] Verificando acesso - Usuário:', user);

    if (!user) {
      console.log('❌ [FinancialDocumentsGuard] Usuário não logado, redirecionando para login');
      this.router.navigate(['/auth/login']);
      return false;
    }

    // Se for admin ou superadmin, permite acessar o seletor de municípios
    if (user.role === 'admin' || user.role === 'superadmin') {
      console.log('✅ [FinancialDocumentsGuard] Admin/Superadmin acessando seletor de municípios');
      return true;
    }

    // Se for user, redireciona direto para os documentos do seu município
    if (user.role === 'user' && user.municipality_code) {
      console.log(`🏢 [FinancialDocumentsGuard] User redirecionando para município: ${user.municipality_code}`);
      this.router.navigate(['/documentacoes-financeiras/municipality', user.municipality_code]);
      return false;
    }

    // Se for user sem município vinculado, redireciona para dashboard
    console.log('⚠️ [FinancialDocumentsGuard] Usuário sem município vinculado');
    this.router.navigate(['/dashboard']);
    return false;
  }
}
