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

    // Verificar se há filtro por município na query string
    const municipalityCode = this.route.snapshot.queryParams['municipality'];
    
    console.log(`🔍 Carregando servidores para letra: ${this.letter}`);
    console.log(`👤 Usuário: ${this.currentUser.email}`);
    console.log(`🏛️ Município do usuário: ${this.currentUser.municipality_code}`);
    console.log(`🏛️ Município do filtro: ${municipalityCode || 'nenhum'}`);
    console.log(`🎫 Token encontrado: ${token.substring(0, 20)}...`);

    // Decidir qual endpoint usar baseado no contexto
    let apiUrl: string;
    if (municipalityCode) {
      // Se há filtro de município na query, usar endpoint específico
      apiUrl = `${environment.apiUrl}/servers/municipality/${municipalityCode}`;
      console.log(`🎯 Usando endpoint filtrado: ${apiUrl}`);
    } else {
      // Senão, usar endpoint padrão (que já filtra baseado no usuário)
      apiUrl = `${environment.apiUrl}/servers`;
      console.log(`🎯 Usando endpoint padrão: ${apiUrl}`);
    }

    // Fazer requisição para obter servidores
    this.http.get<ApiResponse>(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: municipalityCode ? { letter: this.letter } : {}
    }).subscribe({
      next: (response) => {
        console.log('📡 Resposta da API recebida:', response);
        
        if (response.success) {
          let allServers = response.data;
          console.log(`📋 Total de servidores retornados: ${allServers.length}`);
          
          // Filtrar por letra apenas se não foi enviado como parâmetro para o backend
          if (!municipalityCode) {
            allServers = allServers.filter(server => {
              const firstLetter = server.name.charAt(0).toUpperCase();
              const matches = firstLetter === this.letter.toUpperCase();
              console.log(`📝 Servidor "${server.name}" (${firstLetter}) -> ${matches ? 'INCLUÍDO' : 'excluído'}`);
              return matches;
            });
          }
          
          this.servers = allServers.map(server => ({
            ...server,
            // Adicionar propriedades simuladas para compatibilidade
            status: 'online' as 'online' | 'offline',
            ip: '192.168.1.1',
            filesCount: 0,
            lastAccess: new Date()
          }));
            
          // Carregar contagem real de arquivos de cada servidor
          this.servers.forEach(server => {
            this.loadFilesCount(server.id);
          });
            
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

  private loadFilesCount(serverId: number): void {
    const token = this.authService.getToken();
    if (!token) {
      console.error('❌ Token não encontrado para requisição de contagem de arquivos');
      return;
    }

    const url = `${environment.apiUrl}/documents/server/${serverId}/files-count`;
    this.http.get<{ success: boolean; data: number }>(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).subscribe(
      response => {
        if (response.success) {
          const server = this.servers.find(s => s.id === serverId);
          if (server) {
            server.filesCount = response.data;
            console.log(`📊 Atualizado filesCount para servidor ${server.name}: ${response.data}`);
          }
        } else {
          console.error('❌ Erro ao buscar filesCount:', response);
        }
      },
      error => {
        console.error('❌ Erro na requisição filesCount:', error);
      }
    );
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
    const municipalityCode = this.route.snapshot.queryParams['municipality'];
    if (municipalityCode) {
      this.router.navigate(['/servers/municipality', municipalityCode]);
    } else {
      this.router.navigate(['/servers']);
    }
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