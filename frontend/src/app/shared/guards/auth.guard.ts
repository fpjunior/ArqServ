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
        map(({ data: { session } }) => {
          if (session && session.access_token) {
            console.log('🔐 [AUTH GUARD] Sessão Supabase válida encontrada');
            return true;
          } else {
            console.log('🚫 [AUTH GUARD] Sem sessão - redirecionando para login');
            this.router.navigate(['/login']);
            return false;
          }
        })
      );
    }
    
    // Fallback para verificação normal se não usar Supabase
    return this.authService.currentUser$.pipe(
      map(user => {
        if (user) {
          return true;
        } else {
          this.router.navigate(['/login']);
          return false;
        }
      })
    );
  }
}