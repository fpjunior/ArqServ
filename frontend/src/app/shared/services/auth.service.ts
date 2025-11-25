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
  user_type: 'admin' | 'prefeitura';
  municipality?: string;
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
      // OnInit: subscribe to auth state
      supabase.auth.onAuthStateChange((event, session) => {
        if (session && session.access_token) {
          const user = session.user;
          this.tokenSubject.next(session.access_token);
          this.currentUserSubject.next({
            id: user.id as unknown as number,
            email: user.email || '',
            name: user.user_metadata?.['name'] || user.email || '',
            role: user.user_metadata?.['role'] || 'user',
            user_type: (user.user_metadata?.['user_type'] as any) || 'prefeitura',
            municipality: user.user_metadata?.['municipality']
          });
          localStorage.setItem('arqserv_token', session.access_token);
          localStorage.setItem('arqserv_user', JSON.stringify(this.currentUserSubject.value));
        } else {
          this.loadStoredAuth();
        }
      });
    } else {
      this.loadStoredAuth();
    }
  }

  private loadStoredAuth(): void {
    const token = localStorage.getItem('arqserv_token');
    const user = localStorage.getItem('arqserv_user');

    if (token && user) {
      this.tokenSubject.next(token);
      this.currentUserSubject.next(JSON.parse(user));
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
                role: user.user_metadata?.role || 'user',
                user_type: (user.user_metadata?.user_type as any) || 'prefeitura',
                municipality: user.user_metadata?.municipality
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

  register(name: string, email: string, password: string, user_type: string, municipality?: string, role?: string): Observable<any> {
    const useSupabase = environment.useSupabaseAuth || (environment.supabaseUrl && environment.supabaseAnonKey) ? true : false;
    if (useSupabase) {
      const supabase = getSupabaseClient();
      // signUp via Supabase
      return from(supabase.auth.signUp({ email, password, options: { data: { name, role, user_type, municipality } } })).pipe(
        switchMap((r: any) => {
          if (r.error) throw r.error;
          // If signUp created a session or user, sync with backend and then return response
          return this.syncWithBackend().pipe(map(() => r));
        })
      );
    }

    // Legacy backend registration
    return this.http.post<any>(`${this.apiUrl}/auth/register`, { name, email, password, user_type, municipality, role })
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
    return !!this.tokenSubject.value;
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
        if (response?.data?.token) {
          // replace token with backend token and update local user if provided
          localStorage.setItem('arqserv_token', response.data.token);
          this.tokenSubject.next(response.data.token);
          if (response.data.user) {
            localStorage.setItem('arqserv_user', JSON.stringify(response.data.user));
            this.currentUserSubject.next(response.data.user);
          }
        }
      }),
      catchError(err => {
        console.warn('Erro ao sincronizar com backend:', err);
        return of(null);
      })
    );
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

  private handleError(error: any): Observable<never> {
    console.error('Auth Error:', error);
    throw error;
  }
}