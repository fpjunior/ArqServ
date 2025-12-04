import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService, User } from '../../../../shared/services/auth.service';
import { environment } from '../../../../../environments/environment';

interface ServerGroups {
  [key: string]: number;
}

interface Server {
  id: number;
  name: string;
  municipality_code: string;
  municipality_name?: string;
}

interface ApiResponse {
  success: boolean;
  data: Server[];
  message?: string;
  municipality_filter?: string;
}

@Component({
  selector: 'app-servers-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './servers-list.component.html',
  styleUrls: ['./servers-list.component.scss']
})
export class ServersListComponent implements OnInit {
  currentUser: User | null = null;
  searchTerm: string = '';
  loading: boolean = false; // Usado no template
  isLoading: boolean = false; // Compatibilidade com código existente
  totalServers: number = 0;
  municipalityName: string = '';
  debugInfo: any = null;
  
  // Array com todas as letras do alfabeto
  alphabet: string[] = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
  ];

  // Cores disponíveis para os grupos (rotacionando)
  colors: string[] = ['blue', 'green', 'red', 'purple', 'indigo', 'yellow', 'pink', 'gray'];
  
  serverGroups: ServerGroups = {};

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    console.log('🔧 ngOnInit iniciado');
    this.loadUserData();
    // loadServerGroups será chamado automaticamente quando o usuário for carregado
  }

  private loadServerGroups(): void {
    console.log('🚀 loadServerGroups iniciado');
    this.isLoading = true;
    this.loading = true; // Sincronizar ambas as propriedades
    this.totalServers = 0;
    
    // Inicializar informações de debug
    this.debugInfo = {
      municipality: this.currentUser?.municipality_code || 'não definido',
      userName: this.currentUser?.email || 'não logado',
      apiResponse: null,
      error: null
    };
    
    console.log('👤 Usuário atual:', this.currentUser);
    console.log('🏛️ Município do usuário:', this.debugInfo.municipality);
    
    // Inicializar todos os grupos com 0
    this.alphabet.forEach(letter => {
      this.serverGroups[letter] = 0;
    });

    // Obter token de autenticação
    const token = localStorage.getItem('arqserv_token');
    
    if (!token) {
      console.error('❌ Token de autenticação não encontrado');
      this.debugInfo.error = 'Token não encontrado';
      this.isLoading = false;
      this.loading = false;
      return;
    }

    console.log('🔍 Fazendo requisição para:', `${environment.apiUrl}/servers`);

    // Fazer requisição para obter servidores
    this.http.get<ApiResponse>(`${environment.apiUrl}/servers`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (response) => {
        console.log('📡 Resposta da API recebida:', response);
        console.log('📡 Tipo de response:', typeof response);
        console.log('📡 response.success:', response.success);
        console.log('📡 response.data:', response.data);
        console.log('📡 response.data.length:', response.data?.length);
        
        this.debugInfo.apiResponse = JSON.stringify(response, null, 2);
        
        if (response && response.success && Array.isArray(response.data)) {
          console.log(`✅ ${response.data.length} servidores carregados`);
          console.log('🏛️ Filtro de município:', response.municipality_filter || 'Todos (admin)');
          console.log('📋 Lista de servidores:', response.data);
          
          this.totalServers = response.data.length;
          
          // Limpar grupos antes de contar
          this.alphabet.forEach(letter => {
            this.serverGroups[letter] = 0;
          });
          
          // Obter nome do município do primeiro servidor se disponível
          if (response.data.length > 0 && response.data[0].municipality_name) {
            this.municipalityName = response.data[0].municipality_name;
          } else if (this.currentUser?.municipality_code) {
            this.municipalityName = `Município ${this.currentUser.municipality_code}`;
          }
          
          // Agrupar servidores por primeira letra
          response.data.forEach(server => {
            const firstLetter = server.name.charAt(0).toUpperCase();
            console.log(`📝 Servidor "${server.name}" -> Letra: ${firstLetter}`);
            if (this.alphabet.includes(firstLetter)) {
              this.serverGroups[firstLetter] = (this.serverGroups[firstLetter] || 0) + 1;
              console.log(`  ✅ Contagem atualizada para "${firstLetter}": ${this.serverGroups[firstLetter]}`);
            } else {
              console.warn(`  ⚠️ Letra "${firstLetter}" não está no alfabeto`);
            }
          });
          
          console.log('📊 Grupos de servidores finais:', this.serverGroups);
          console.log('📊 Total de servidores:', this.totalServers);
        } else {
          console.error('❌ Resposta inválida da API:', response);
          this.debugInfo.error = 'Resposta inválida da API';
        }
        this.isLoading = false;
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ Erro ao carregar servidores:', error);
        console.error('❌ Status:', error.status);
        console.error('❌ Body:', error.error);
        
        this.debugInfo.error = `Status: ${error.status}, Mensagem: ${error.message}`;
        
        // Em caso de erro, usar dados mockados temporariamente
        this.initializeServerGroupsFallback();
        this.isLoading = false;
        this.loading = false;
      }
    });
  }

  private initializeServerGroupsFallback(): void {
    console.log('⚠️ Usando dados mockados como fallback - API não disponível ou sem dados');
    this.totalServers = 0;
    
    // Inicializar alguns grupos com números pequenos para indicar que há um problema
    this.alphabet.forEach((letter, index) => {
      // Só algumas letras para indicar que algo não está funcionando
      if (['A', 'B', 'C', 'J', 'M', 'S'].includes(letter)) {
        this.serverGroups[letter] = 1;
        this.totalServers++;
      } else {
        this.serverGroups[letter] = 0;
      }
    });
  }

  private loadUserData(): void {
    console.log('👤 loadUserData iniciado');
    this.authService.currentUser$.subscribe(user => {
      console.log('👤 Observable do usuário ativado:', user);
      this.currentUser = user;
      if (!this.currentUser) {
        console.log('❌ Usuário não encontrado, redirecionando para login');
        this.router.navigate(['/auth/login']);
      } else {
        console.log(`✅ Usuário logado: ${this.currentUser.email}`);
        console.log(`👑 Role: ${this.currentUser.role}`);
        console.log(`🏛️ Município: ${this.currentUser.municipality_code || 'Não definido'}`);
        
        // Sempre forçar refresh dos dados para garantir sincronização
        console.log('🔄 Sincronizando dados do usuário...');
        this.authService.refreshUserData().subscribe({
          next: () => {
            console.log('✅ Dados sincronizados, carregando servidores...');
            // Após sincronizar, carregar servidores
            this.loadServerGroups();
          },
          error: (error) => {
            console.error('❌ Erro ao sincronizar dados:', error);
            // Mesmo com erro, tentar carregar servidores
            this.loadServerGroups();
          }
        });
      }
    });
  }

  refreshUserData(): void {
    console.log('🔄 Forçando refresh manual dos dados...');
    this.authService.refreshUserData().subscribe({
      next: () => {
        console.log('✅ Refresh manual concluído');
        this.loadServerGroups(); // Recarregar servidores
      },
      error: (error) => {
        console.error('❌ Erro no refresh manual:', error);
      }
    });
  }

  getGroupColor(letter: string): string {
    // Retorna uma cor baseada no índice da letra no alfabeto
    const index = this.alphabet.indexOf(letter);
    return this.colors[index % this.colors.length];
  }

  navigateToGroup(letter: string): void {
    console.log(`Navegando para servidores com letra ${letter}`);
    // Navegar para a página de servidores por letra
    this.router.navigate(['/servers', letter]);
  }

  onSearch(): void {
    console.log('Buscando por:', this.searchTerm);
    // TODO: Implementar funcionalidade de busca
  }
}