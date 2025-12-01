import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

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
  ) {}

  canActivate(): Observable<boolean> {
    // Se está usando Supabase, verificar sessão diretamente primeiro
    if (environment.useSupabaseAuth) {
      const supabase = getSupabaseClient();
      return from(supabase.auth.getSession()).pipe(
        switchMap(({ data: { session } }) => {
          if (session && session.access_token) {
            console.log('🔐 [AUTH GUARD] Sessão Supabase válida encontrada');
            
            // Fazer refresh dos dados do usuário para garantir role atualizado
            return this.authService.refreshUserData().pipe(
              map(() => true)
            );
          } else {
            console.log('🚫 [AUTH GUARD] Sem sessão - redirecionando para login');
            this.router.navigate(['/login']);
            return [false];
          }
        })
      );
    }
    
    // Fallback para verificação normal se não usar Supabase
    return this.authService.currentUser$.pipe(
      switchMap(user => {
        if (user) {
          // Fazer refresh dos dados para garantir consistência
          return this.authService.refreshUserData().pipe(
            map(() => true)
          );
        } else {
          this.router.navigate(['/login']);
          return [false];
        }
      })
    );
  }
}