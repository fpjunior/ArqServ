import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, from, throwError } from 'rxjs';
import { map, tap, catchError, switchMap, retry, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { getSupabaseClient } from '../supabase/supabase.client';

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  municipality_code?: string;
}

export interface LoginResponse {
  status: string;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);

  public currentUser$ = this.currentUserSubject.asObservable();
  public token$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {
    // If using Supabase auth, initialize client and subscribe to supabase auth state
    if (environment.useSupabaseAuth) {
      const supabase = getSupabaseClient();
      
      // Carregar sessão atual do Supabase imediatamente
      supabase.auth.getSession().then(({ data: { session } }) => {
        console.log('🔍 [AUTH] Sessão inicial do Supabase:', session ? 'Encontrada' : 'Não encontrada');
        if (session && session.access_token) {
          const user = session.user;
          
          // Log detalhado do user_metadata
          console.log('📋 [AUTH] User metadata do Supabase:', {
            user_metadata: user.user_metadata,
            app_metadata: user.app_metadata,
            role: user.user_metadata?.['role'],
            email: user.email
          });
          
          // Primeiro tentar carregar do localStorage se existir (preserva role correto)
          const storedUser = localStorage.getItem('arqserv_user');
          let userRole = 'user';
          let preserveLocalData = false;
          
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              userRole = parsedUser.role || 'user';
              // Se já temos um admin no localStorage, preservar esses dados
              if (parsedUser.role === 'admin') {
                preserveLocalData = true;
                console.log('✅ [AUTH] Admin role preservado do localStorage:', userRole);
              }
            } catch (e) {
              console.warn('⚠️ [AUTH] Erro ao parsear usuário do localStorage');
            }
          }
          
          // Se não tem no localStorage ou role não é admin, usar do Supabase
          if (!preserveLocalData && user.user_metadata?.['role']) {
            userRole = user.user_metadata['role'];
            console.log('✅ [AUTH] Role recuperado do Supabase metadata:', userRole);
          }
          
          const currentUser = {
            id: user.id as unknown as number,
            email: user.email || '',
            name: user.user_metadata?.['name'] || user.email || '',
            role: userRole
          };
          
          this.tokenSubject.next(session.access_token);
          this.currentUserSubject.next(currentUser);
          localStorage.setItem('arqserv_token', session.access_token);
          localStorage.setItem('arqserv_user', JSON.stringify(currentUser));
          
          console.log('✅ [AUTH] Sessão Supabase carregada:', currentUser);
          
          // Sincronizar com backend para garantir role correto
          this.syncWithBackend().subscribe({
            next: () => console.log('✅ [AUTH] Sincronização com backend concluída'),
            error: (err) => console.warn('⚠️ [AUTH] Erro na sincronização:', err)
          });
        } else {
          console.log('ℹ️ [AUTH] Nenhuma sessão ativa no Supabase');
        }
      });

      // OnInit: subscribe to auth state changes
      supabase.auth.onAuthStateChange((event, session) => {
        console.log('🔄 [AUTH] Mudança de estado:', event, session ? 'com sessão' : 'sem sessão');
        
        if (session && session.access_token) {
          console.log('🔄 [AUTH] Atualizando token...');
          
          // SEMPRE atualizar token
          this.tokenSubject.next(session.access_token);
          localStorage.setItem('arqserv_token', session.access_token);
          
          // Para login, sincronizar com backend para obter role correto
          if (event === 'SIGNED_IN') {
            console.log('🔐 [AUTH] LOGIN detectado - obtendo role AUTORITATIVO do backend...');
            this.syncWithBackend().subscribe({
              next: () => console.log('✅ [AUTH] Role autoritativo aplicado pós-login'),
              error: (err) => console.warn('⚠️ [AUTH] Erro na sincronização pós-login:', err)
            });
          } else {
            console.log('ℹ️ [AUTH] Evento não é SIGNED_IN - mantendo dados existentes');
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('🚪 [AUTH] Usuário fez logout');
          this.tokenSubject.next(null);
          this.currentUserSubject.next(null);
          localStorage.removeItem('arqserv_token');
          localStorage.removeItem('arqserv_user');
        }
      });
    } else {
      this.loadStoredAuth();
    }
  }

  private loadStoredAuth(): void {
    const token = localStorage.getItem('arqserv_token');
    const user = localStorage.getItem('arqserv_user');

    console.log('🔍 [AUTH] loadStoredAuth - Verificando localStorage:', {
      hasToken: !!token,
      hasUser: !!user,
      tokenPreview: token ? `${token.substring(0, 20)}...` : null
    });

    if (token && user) {
      // Verificar se o token ainda é válido
      if (this.isTokenValid(token)) {
        this.tokenSubject.next(token);
        this.currentUserSubject.next(JSON.parse(user));
        console.log('✅ [AUTH] Sessão restaurada do localStorage');
      } else {
        // Token expirado, limpar localStorage
        console.warn('⚠️ [AUTH] Token expirado detectado no refresh - limpando sessão');
        localStorage.removeItem('arqserv_token');
        localStorage.removeItem('arqserv_user');
        this.tokenSubject.next(null);
        this.currentUserSubject.next(null);
      }
    } else {
      console.log('ℹ️ [AUTH] Nenhum token ou usuário encontrado no localStorage');
    }
  }

  /**
   * Verifica se o token JWT é válido e não expirou
   */
  private isTokenValid(token: string): boolean {
    if (!token) return false;

    try {
      // Decodificar o token JWT (formato: header.payload.signature)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('⚠️ [AUTH] Token inválido - formato incorreto');
        return false;
      }

      // Decodificar o payload (parte do meio)
      const payload = JSON.parse(atob(parts[1]));
      
      if (!payload || typeof payload !== 'object') {
        console.warn('⚠️ [AUTH] Token inválido - payload inválido');
        return false;
      }

      console.log('🔍 [AUTH] Token payload decodificado:', {
        userId: payload.id,
        email: payload.email,
        role: payload.role,
        exp: payload.exp,
        expDate: payload.exp ? new Date(payload.exp * 1000).toLocaleString() : 'N/A',
        iat: payload.iat,
        iatDate: payload.iat ? new Date(payload.iat * 1000).toLocaleString() : 'N/A'
      });

      // Verificar se tem campo de expiração
      if (!payload.exp) {
        console.warn('⚠️ [AUTH] Token sem expiração - considerando válido');
        return true; // Se não tem expiração, considerar válido
      }

      // Verificar se o token expirou (exp é em segundos desde epoch)
      const now = Math.floor(Date.now() / 1000);
      const isValid = payload.exp > now;
      
      if (!isValid) {
        const expiredDate = new Date(payload.exp * 1000);
        const nowDate = new Date();
        const timeAgo = Math.floor((nowDate.getTime() - expiredDate.getTime()) / 1000 / 60); // minutos
        console.warn('⚠️ [AUTH] Token expirado:', {
          expiredAt: expiredDate.toLocaleString(),
          now: nowDate.toLocaleString(),
          expiredMinutesAgo: timeAgo
        });
      } else {
        const timeRemaining = Math.floor((payload.exp - now) / 60); // minutos
        console.log('✅ [AUTH] Token válido - expira em', timeRemaining, 'minutos');
      }

      return isValid;
    } catch (error) {
      console.error('❌ [AUTH] Erro ao validar token:', error);
      return false;
    }
  }

  login(email: string, password: string): Observable<LoginResponse> {
    // Always prefer Supabase when configured (either via flag or presence of keys)
    const useSupabase = environment.useSupabaseAuth || (environment.supabaseUrl && environment.supabaseAnonKey) ? true : false;
    if (useSupabase) {
      // Use Supabase auth with fallback to legacy backend login if Supabase is unreachable
      const supabase = getSupabaseClient();
      return from(supabase.auth.signInWithPassword({ email, password })).pipe(
        // If Supabase is slow or unreachable, timeout quickly and fallback
        timeout(6000),
        switchMap((result: any) => {
          if (result?.error) {
            // Supabase returned a handled error (invalid credentials). Fallback to backend login.
            console.warn('Supabase sign-in failed, trying backend login fallback:', result.error);
            return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email, password }).pipe(
              // mark as backend origin
              map(response => ({ origin: 'backend', response }))
            );
          }
          const session = result.data?.session;
          const user = result.data?.user;
          // Normalize result to previous API response format for compatibility
          const loginResponse: any = {
            status: 'SUCCESS',
            message: 'Login via Supabase OK',
            data: {
              token: session.access_token,
              user: {
                id: user.id as unknown as number,
                email: user.email || '',
                name: user.user_metadata?.name || user.email || '',
                role: user.user_metadata?.role || 'user'
              }
            }
          };
          return of({ origin: 'supabase', response: loginResponse });
        }),
        // If request failed due to network or timeout, try the legacy backend login
        catchError((err) => {
          console.warn('Supabase login threw an error (network/timeout). Falling back to backend login.', err);
          return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email, password }).pipe(
            map(response => ({ origin: 'backend', response })),
            catchError(innerErr => {
              // propagate error through handleError
              return throwError(() => innerErr);
            })
          );
        }),
        // Handle both origins and optionally sync only when origin is supabase
        map((payload: any) => payload),
        tap((payload: any) => {
          const response = payload.response || payload;
          this.handleAuthResponse(response);
          if (payload.origin === 'supabase') {
            // Sync with backend (create user in backend if needed and get backend token)
            this.syncWithBackend().subscribe({ next: () => {}, error: () => {} });
          }
        }),
        // finally map back to original LoginResponse for consumers
        map((payload: any) => payload.response || payload)
      );
    }
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email, password })
      .pipe(
        timeout(30000), // 30 segundos para cold start
        retry(1), // Retry uma vez em caso de timeout
        map(response => {
          if (response.status === 'SUCCESS') {
            return response;
          } else {
            throw new Error(response.message || 'Erro no login');
          }
        }),
        tap(response => this.handleAuthResponse(response)),
        catchError(this.handleError)
      );
  }

  // Explicit backend login route (bypass Supabase)
  loginBackend(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email, password })
      .pipe(
        timeout(30000),
        retry(1),
        tap(response => this.handleAuthResponse(response)),
        catchError(this.handleError)
      );
  }

  register(name: string, email: string, password: string, user_type: string, municipality?: string, role?: string, municipality_code?: string): Observable<any> {
    const useSupabase = environment.useSupabaseAuth || (environment.supabaseUrl && environment.supabaseAnonKey) ? true : false;
    if (useSupabase) {
      const supabase = getSupabaseClient();
      // signUp via Supabase
      return from(supabase.auth.signUp({ 
        email, 
        password, 
        options: { 
          data: { 
            name, 
            role, 
            user_type, 
            municipality,
            municipality_code 
          } 
        } 
      })).pipe(
        switchMap((r: any) => {
          if (r.error) throw r.error;
          // If signUp created a session or user, sync with backend and then return response
          return this.syncWithBackend().pipe(map(() => r));
        })
      );
    }

    // Legacy backend registration
    const registerData: any = { name, email, password, user_type, role };
    if (municipality) registerData.municipality = municipality;
    if (municipality_code) registerData.municipality_code = municipality_code;
    
    console.log('📤 [AUTH] Registrando usuário no backend:', { ...registerData, password: '[HIDDEN]' });
    
    return this.http.post<any>(`${this.apiUrl}/auth/register`, registerData)
      .pipe(catchError(this.handleError));
  }

  private handleAuthResponse(response: LoginResponse | any): void {
    // Supports Supabase normalized and legacy backend payloads
    const token = response.data?.token || (response.data?.token === undefined ? response?.data?.token : response?.token);
    const user = response.data?.user || response.data?.user || response?.data?.user || response?.user || response.user;

    if (token) localStorage.setItem('arqserv_token', token as string);
    if (user) localStorage.setItem('arqserv_user', JSON.stringify(user));

    this.tokenSubject.next(token || null);
    this.currentUserSubject.next(user || null);
  }

  async logout(): Promise<void> {
    if (environment.useSupabaseAuth) {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    }
    localStorage.removeItem('arqserv_token');
    localStorage.removeItem('arqserv_user');

    this.tokenSubject.next(null);
    this.currentUserSubject.next(null);
  }

  isAuthenticated(): boolean {
    const token = this.tokenSubject.value;
    if (!token) return false;
    
    // Verificar se o token ainda é válido
    return this.isTokenValid(token);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  // Optionally call backend to sync supabase user and obtain backend token
  syncWithBackend(): Observable<any> {
    const token = this.getToken();
    if (!token) return of(null);
    const headers = { Authorization: `Bearer ${token}` };
    return this.http.post<any>(`${this.apiUrl}/auth/supabase/sync`, {}, { headers: headers }).pipe(
      tap((response: any) => {
        if (response?.data?.token && response?.data?.user) {
          const backendUser = response.data.user;
          console.log('🎯 [AUTH] BACKEND SYNC - Role da tabela users:', backendUser.role);
          console.log('🏛️ [AUTH] BACKEND SYNC - Municipality:', backendUser.municipality_code);
          
          // SEMPRE usar dados do backend (tabela users) como autoritativo
          localStorage.setItem('arqserv_token', response.data.token);
          localStorage.setItem('arqserv_user', JSON.stringify(backendUser));
          this.tokenSubject.next(response.data.token);
          this.currentUserSubject.next(backendUser);
          
          console.log('✅ [AUTH] Role DEFINITIVO aplicado:', backendUser.role);
          console.log('✅ [AUTH] Municipality DEFINITIVO aplicado:', backendUser.municipality_code);
        }
      }),
      catchError(err => {
        console.warn('⚠️ [AUTH] Erro ao sincronizar com backend:', err);
        return of(null);
      })
    );
  }

  /**
   * Força sincronização com o backend para atualizar dados do usuário
   * Útil quando dados do usuário são atualizados no banco
   */
  refreshUserData(): Observable<any> {
    console.log('🔄 [AUTH] Forçando refresh dos dados do usuário...');
    return this.syncWithBackend();
  }

  invite(email: string, redirectTo?: string): Observable<any> {
    const token = this.getToken();
    const url = `${this.apiUrl}/auth/invite`;
    const body = { email, redirectTo };
    if (token) {
      const headers = { Authorization: `Bearer ${token}` };
      return this.http.post<any>(url, body, { headers }).pipe(
        tap(() => console.log('Invite sent to', email)),
        catchError(err => {
          console.error('Erro ao enviar convite:', err);
          throw err;
        })
      );
    }
    // No token, call without headers
    return this.http.post<any>(url, body).pipe(
      tap(() => console.log('Invite sent to', email)),
      catchError(err => {
        console.error('Erro ao enviar convite:', err);
        throw err;
      })
    );
  }

  /**
   * Verifica se o usuário atual é admin
   */
  isAdmin(): boolean {
    const user = this.getCurrentUser();
    const isAdminRole = user?.role === 'admin';
    console.log('🔍 [AUTH] Verificação admin:', { user: user?.email, role: user?.role, isAdmin: isAdminRole });
    return isAdminRole;
  }

  /**
   * Força atualização de role para admin (para casos onde backend confirma admin)
   */
  updateUserRole(newRole: string): void {
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      const updatedUser = { ...currentUser, role: newRole };
      localStorage.setItem('arqserv_user', JSON.stringify(updatedUser));
      this.currentUserSubject.next(updatedUser);
      console.log('✅ [AUTH] Role atualizado para:', newRole);
    }
  }

  private handleError(error: any): Observable<never> {
    console.error('Auth Error:', error);
    throw error;
  }
}