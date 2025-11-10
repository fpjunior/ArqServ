import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'prefeitura' | 'empresa';
  municipio?: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api'; // Backend URL - será configurado posteriormente
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
    // Por enquanto, simularemos o login para desenvolvimento
    return this.simulateLogin(email, password);
    
    // Quando o backend estiver pronto, use esta implementação:
    // return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email, password })
    //   .pipe(
    //     tap(response => this.handleAuthResponse(response)),
    //     catchError(this.handleError)
    //   );
  }

  private simulateLogin(email: string, password: string): Observable<LoginResponse> {
    // Simulação de login para desenvolvimento
    const mockUsers = [
      {
        id: '1',
        email: 'admin@empresa.com',
        name: 'Administrador Empresa',
        role: 'empresa' as const
      },
      {
        id: '2',
        email: 'prefeitura@cidade.gov.br',
        name: 'Gestor Municipal',
        role: 'prefeitura' as const,
        municipio: 'Cidade Exemplo'
      }
    ];

    const user = mockUsers.find(u => u.email === email);
    
    if (user && password === '123456') {
      const response: LoginResponse = {
        user,
        token: 'mock_jwt_token_' + Date.now(),
        refreshToken: 'mock_refresh_token_' + Date.now()
      };

      return of(response).pipe(
        tap(response => this.handleAuthResponse(response))
      );
    } else {
      return new Observable(observer => {
        setTimeout(() => {
          observer.error({ error: { message: 'Credenciais inválidas' } });
        }, 1000);
      });
    }
  }

  private handleAuthResponse(response: LoginResponse): void {
    localStorage.setItem('arqserv_token', response.token);
    localStorage.setItem('arqserv_user', JSON.stringify(response.user));
    localStorage.setItem('arqserv_refresh_token', response.refreshToken);

    this.tokenSubject.next(response.token);
    this.currentUserSubject.next(response.user);
  }

  logout(): void {
    localStorage.removeItem('arqserv_token');
    localStorage.removeItem('arqserv_user');
    localStorage.removeItem('arqserv_refresh_token');

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