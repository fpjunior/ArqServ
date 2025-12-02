import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService, User } from '../../../../shared/services/auth.service';
import { environment } from '../../../../../environments/environment';

interface ServerInfo {
  id: number;
  name: string;
  municipality_code: string;
  municipality_name?: string;
  created_at?: string;
  // Propriedades simuladas para compatibilidade com template
  status?: 'online' | 'offline';
  ip?: string;
  filesCount?: number;
  lastAccess?: Date;
}

interface ApiResponse {
  success: boolean;
  data: ServerInfo[];
  message?: string;
}

@Component({
  selector: 'app-servers-by-letter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './servers-by-letter.component.html',
  styleUrls: ['./servers-by-letter.component.scss']
})
export class ServersByLetterComponent implements OnInit {
  letter: string = '';
  servers: ServerInfo[] = [];
  searchTerm: string = '';
  filteredServers: ServerInfo[] = [];
  isLoading: boolean = false;
  currentUser: User | null = null;

  constructor(
    private route: ActivatedRoute, 
    private router: Router,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    console.log('🔧 ServersByLetter ngOnInit iniciado');
    
    // Carregar usuário primeiro
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (!this.currentUser) {
        console.log('❌ Usuário não encontrado, redirecionando para login');
        this.router.navigate(['/auth/login']);
        return;
      }
      
      console.log(`✅ Usuário: ${this.currentUser.email}, Município: ${this.currentUser.municipality_code}`);
      
      // Agora carregar servidores com usuário autenticado
      this.route.params.subscribe(params => {
        this.letter = params['letter'];
        console.log(`📝 Carregando servidores para letra: ${this.letter}`);
        this.loadServers();
      });
    });
  }

  private loadServers(): void {
    this.isLoading = true;
    
    // Verificar se usuário está logado
    if (!this.currentUser) {
      console.error('❌ Usuário não encontrado');
      this.isLoading = false;
      return;
    }
    
    // Obter token de autenticação do AuthService, não do localStorage
    const token = this.authService.getToken();
    if (!token) {
      console.error('❌ Token não encontrado - solicitando refresh dos dados');
      // Tentar refresh dos dados ao invés de redirecionar imediatamente
      this.authService.refreshUserData().subscribe({
        next: () => {
          console.log('✅ Dados refreshados, tentando novamente...');
          this.loadServers(); // Tentar novamente após refresh
        },
        error: () => {
          console.error('❌ Falha no refresh, redirecionando para login');
          this.router.navigate(['/auth/login']);
        }
      });
      this.isLoading = false;
      return;
    }

    console.log(`🔍 Carregando servidores para letra: ${this.letter}`);
    console.log(`👤 Usuário: ${this.currentUser.email}`);
    console.log(`🏛️ Município: ${this.currentUser.municipality_code}`);
    console.log(`🎫 Token encontrado: ${token.substring(0, 20)}...`);

    // Fazer requisição para obter servidores filtrados por letra
    this.http.get<ApiResponse>(`${environment.apiUrl}/servers`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (response) => {
        console.log('📡 Resposta da API recebida:', response);
        
        if (response.success) {
          const allServers = response.data;
          console.log(`📋 Total de servidores retornados: ${allServers.length}`);
          
          this.servers = allServers
            .filter(server => {
              const firstLetter = server.name.charAt(0).toUpperCase();
              const matches = firstLetter === this.letter.toUpperCase();
              console.log(`📝 Servidor "${server.name}" (${firstLetter}) -> ${matches ? 'INCLUÍDO' : 'excluído'}`);
              return matches;
            })
            .map(server => ({
              ...server,
              // Adicionar propriedades simuladas para compatibilidade
              status: Math.random() > 0.3 ? 'online' : 'offline' as 'online' | 'offline',
              ip: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
              filesCount: Math.floor(Math.random() * 50) + 1,
              lastAccess: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // últimos 7 dias
            }));
            
          this.filteredServers = [...this.servers];
          console.log(`✅ ${this.servers.length} servidores carregados para letra ${this.letter}`);
          console.log('📄 Servidores filtrados:', this.servers.map(s => s.name));
        } else {
          console.error('❌ Erro na resposta da API:', response.message);
          this.servers = [];
          this.filteredServers = [];
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Erro ao carregar servidores:', error);
        console.error('❌ Status do erro:', error.status);
        console.error('❌ Mensagem:', error.message);
        
        // Se erro de autenticação, redirecionar para login
        if (error.status === 401 || error.status === 403) {
          console.warn('🚫 Erro de autenticação - redirecionando para login');
          this.router.navigate(['/auth/login']);
          return;
        }
        
        this.servers = [];
        this.filteredServers = [];
        this.isLoading = false;
      }
    });
  }

  onSearch(): void {
    if (!this.searchTerm.trim()) {
      this.filteredServers = [...this.servers];
    } else {
      this.filteredServers = this.servers.filter(server =>
        server.name.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
  }

  navigateToServerDetails(serverId: number): void {
    this.router.navigate(['/servers', this.letter, serverId]);
  }

  goBack(): void {
    this.router.navigate(['/servers']);
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  getStatusColor(status: string): string {
    return status === 'online' ? 'text-green-600' : 'text-red-600';
  }

  getStatusBgColor(status: string): string {
    return status === 'online' ? 'bg-green-100' : 'bg-red-100';
  }
}