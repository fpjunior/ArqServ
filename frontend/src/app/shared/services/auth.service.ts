import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, tap, catchError, switchMap, retry, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
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
    this.loadStoredAuth();
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

  private handleAuthResponse(response: LoginResponse): void {
    localStorage.setItem('arqserv_token', response.data.token);
    localStorage.setItem('arqserv_user', JSON.stringify(response.data.user));

    this.tokenSubject.next(response.data.token);
    this.currentUserSubject.next(response.data.user);
  }

  logout(): void {
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

  private handleError(error: any): Observable<never> {
    console.error('Auth Error:', error);
    throw error;
  }
}