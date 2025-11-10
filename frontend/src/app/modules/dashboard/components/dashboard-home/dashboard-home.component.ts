import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../../../shared/services/auth.service';

interface DashboardStats {
  totalServers: number;
  totalDocuments: number;
  recentUploads: number;
  pendingReviews: number;
  storageUsed: number;
  storageLimit: number;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  route?: string;
  action?: () => void;
  roleRequired?: 'empresa' | 'prefeitura';
}

interface RecentActivity {
  id: string;
  type: 'upload' | 'view' | 'download' | 'edit';
  title: string;
  description: string;
  timestamp: Date;
  user: string;
  icon: string;
}

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-home.component.html',
  styleUrls: ['./dashboard-home.component.scss']
})
export class DashboardHomeComponent implements OnInit {
  currentUser: User | null = null;
  searchTerm = '';
  
  stats: DashboardStats = {
    totalServers: 1547,
    totalDocuments: 23456,
    recentUploads: 47,
    pendingReviews: 12,
    storageUsed: 75.5,
    storageLimit: 100
  };

  quickActions: QuickAction[] = [
    {
      id: 'servers',
      title: 'Gerenciar Servidores',
      description: 'Visualize e organize servidores por grupos alfabéticos',
      icon: '👥',
      route: '/dashboard/servers'
    },
    {
      id: 'upload',
      title: 'Upload de Documentos',
      description: 'Adicione novos arquivos e documentos ao sistema',
      icon: '☁️',
      roleRequired: 'empresa'
    },
    {
      id: 'reports',
      title: 'Relatórios Detalhados',
      description: 'Visualize estatísticas e relatórios completos',
      icon: '📊'
    },
    {
      id: 'search',
      title: 'Busca Avançada',
      description: 'Encontre documentos e servidores rapidamente',
      icon: '🔍'
    },
    {
      id: 'settings',
      title: 'Configurações',
      description: 'Gerencie preferências e configurações do sistema',
      icon: '⚙️'
    },
    {
      id: 'backup',
      title: 'Backup e Sincronização',
      description: 'Configure backup automático dos documentos',
      icon: '💾',
      roleRequired: 'empresa'
    }
  ];

  recentActivities: RecentActivity[] = [
    {
      id: '1',
      type: 'upload',
      title: 'Novo documento adicionado',
      description: 'Contrato_Silva_2024.pdf - João Silva',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      user: 'João Silva',
      icon: '📄'
    },
    {
      id: '2',
      type: 'view',
      title: 'Documento visualizado',
      description: 'Relatório_Anual.xlsx - Maria Santos',
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
      user: 'Maria Santos',
      icon: '👁️'
    },
    {
      id: '3',
      type: 'edit',
      title: 'Informações atualizadas',
      description: 'Cadastro de Ana Costa foi atualizado',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      user: 'Ana Costa',
      icon: '✏️'
    },
    {
      id: '4',
      type: 'download',
      title: 'Download realizado',
      description: 'Certidão_Nascimento.pdf - Pedro Lima',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      user: 'Pedro Lima',
      icon: '⬇️'
    },
    {
      id: '5',
      type: 'upload',
      title: 'Múltiplos documentos',
      description: '5 documentos adicionados por Carlos Mendes',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      user: 'Carlos Mendes',
      icon: '📁'
    }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    this.loadDashboardData();
  }

  loadDashboardData() {
    // Simula carregamento de dados do dashboard
    // Aqui você faria chamadas para APIs reais
  }

  onSearch() {
    if (this.searchTerm.trim()) {
      console.log('Searching for:', this.searchTerm);
      // Implementar busca
    }
  }

  executeQuickAction(action: QuickAction) {
    // Verifica se o usuário tem permissão
    if (action.roleRequired && this.currentUser?.role !== action.roleRequired) {
      alert('Você não tem permissão para acessar esta funcionalidade.');
      return;
    }

    if (action.route) {
      this.router.navigate([action.route]);
    } else if (action.action) {
      action.action();
    } else {
      // Implementar ação padrão
      console.log('Executing action:', action.id);
    }
  }

  getFilteredQuickActions(): QuickAction[] {
    return this.quickActions.filter(action => 
      !action.roleRequired || action.roleRequired === this.currentUser?.role
    );
  }

  formatTime(date: Date): string {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `${minutes} min atrás`;
    } else if (hours < 24) {
      return `${hours}h atrás`;
    } else {
      return `${days}d atrás`;
    }
  }

  getStoragePercentage(): number {
    return (this.stats.storageUsed / this.stats.storageLimit) * 100;
  }

  navigateToActivity(activity: RecentActivity) {
    // Implementar navegação para detalhes da atividade
    console.log('Navigating to activity:', activity);
  }

  refreshData() {
    this.loadDashboardData();
    // Mostrar feedback de atualização
  }
}