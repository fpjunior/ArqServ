import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { AuthService } from '../services/auth.service';
import { getSupabaseClient } from '../supabase/supabase.client';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  canActivate(): Observable<boolean> | boolean {
    // Primeiro verificar se já temos autenticação no serviço
    if (this.authService.isAuthenticated()) {
      console.log('🔐 [AUTH GUARD] Usuário autenticado via AuthService');
      return true;
    }

    // Se está usando Supabase, verificar sessão diretamente
    if (environment.useSupabaseAuth) {
      const supabase = getSupabaseClient();
      return from(supabase.auth.getSession()).pipe(
        map(({ data: { session } }) => {
          if (session && session.access_token) {
            console.log('🔐 [AUTH GUARD] Sessão Supabase válida encontrada');
            return true;
          } else {
            console.log('🚫 [AUTH GUARD] Sem sessão - redirecionando para login');
            this.router.navigate(['/login']);
            return false;
          }
        }),
        catchError((error) => {
          console.error('❌ [AUTH GUARD] Erro ao verificar sessão:', error);
          this.router.navigate(['/login']);
          return of(false);
        })
      );
    }

    // Fallback: se não há autenticação, redirecionar para login
    console.log('🚫 [AUTH GUARD] Sem autenticação - redirecionando para login');
    this.router.navigate(['/login']);
    return false;
  }
}
