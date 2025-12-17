import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../../../shared/services/auth.service';
import { DocumentsService } from '../../../../services/documents.service';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

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

interface LocalDashboardStats {
  totalServers: number;
  totalDocuments: number;
  recentUploads: number;
  pendingReviews: number;
  storageUsed: number;
  storageLimit: number;
  viewsToday: number;
  downloadsToday: number;
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
  isRefreshing = false;

  storageUsed: number = 0;
  storageTotal: number = 0;

  stats: LocalDashboardStats = {
    totalServers: 0,
    totalDocuments: 0,
    recentUploads: 0,
    pendingReviews: 0,
    storageUsed: 0,
    storageLimit: 0,
    viewsToday: 0,
    downloadsToday: 0
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

  recentActivities: RecentActivity[] = [];
  recentDocuments: any[] = [];

  constructor(
    private documentsService: DocumentsService,
    private authService: AuthService,
    public router: Router
  ) { }

  ngOnInit() {
    console.log('🔵 [DASHBOARD-HOME] ngOnInit chamado');
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    this.loadDashboardStats();
    this.loadRecentActivities();
    this.loadRecentDocuments();
    this.fetchStorageInfo();
    this.currentUser = this.authService.getCurrentUser();
  }

  loadRecentDocuments() {
    console.log('🔵 [DASHBOARD] Carregando documentos recentes...');
    this.documentsService.getRecentDocuments(6).subscribe({ // Requesting more to allow for filtering
      next: (response: any) => {
        if (response && response.success && response.data) {
          const allDocs = response.data;

          this.recentDocuments = allDocs
            .filter((doc: any) => {
              // 1. Basic Existence Check
              if (!doc) return false;

              // 2. Garbage Check (must have some ID or content)
              const hasId = doc.id || doc.googleDriveId;
              const hasContent = doc.title || doc.file_name || doc.fileName;
              if (!hasId && !hasContent) return false;

              return true;
            })
            .map((doc: any) => {
              // 3. Normalization & Sanitization
              let cleanTitle = doc.title || doc.fileName || doc.file_name || 'Documento Sem Título';
              cleanTitle = cleanTitle.trim();

              // Fix bad titles like "."
              const validTitleRegex = /[a-zA-Z0-9\u00C0-\u00FF]/;
              if (cleanTitle === '.' || cleanTitle.length < 2 || !validTitleRegex.test(cleanTitle)) {
                cleanTitle = 'Documento Recuperado';
              }

              // Fix missing icon
              let icon = doc.icon;
              if (!icon || icon.trim() === '') {
                const t = cleanTitle.toLowerCase();
                if (t.endsWith('.pdf') || t.includes('pdf')) icon = '📕';
                else if (t.endsWith('.jpg') || t.endsWith('.png') || t.includes('imagem')) icon = '🖼️';
                else if (t.includes('xls') || t.includes('planilha')) icon = '📊';
                else if (t.includes('doc') || t.includes('word')) icon = '📝';
                else icon = '📄';
              }

              // Fix missing subtitles
              let sub = doc.subTitle || 'Documento';
              if (sub === '.' || !sub.trim()) sub = 'Google Drive';

              // Ensure Drive ID availability
              let gId = doc.googleDriveId;
              if (!gId && typeof doc.id === 'string' && doc.id.startsWith('drive_')) {
                gId = doc.id.replace('drive_', '');
              }

              // Date Normalization
              let timestampStr = doc.updatedAt;
              if (timestampStr && !timestampStr.endsWith('Z')) {
                timestampStr += 'Z';
              }

              return {
                ...doc,
                id: doc.id,
                title: cleanTitle,
                subTitle: sub, // Ensure subtitle is good
                icon: icon,
                googleDriveId: gId,
                updatedAt: new Date(timestampStr),
                // Novos campos para admin
                municipalityName: doc.municipalityName || null,
                municipalityCode: doc.municipalityCode || null,
                folderName: doc.folderName || null
              };
            })
            .slice(0, 4); // Take top 4 FINAL VALID documents

          console.log('✅ [DASHBOARD] Documentos recentes processados:', this.recentDocuments);
        }
      },
      error: (error) => {
        console.error('❌ [DASHBOARD] Erro ao carregar documentos recentes:', error);
      }
    });
  }

  loadDashboardStats() {
    console.log('🟢 [DASHBOARD] Iniciando carregamento de estatísticas...');
    console.log('🟢 [DASHBOARD] URL da API:', 'http://localhost:3005/api/dashboard/stats');

    this.documentsService.getDashboardStats().subscribe(
      (response: any) => {
        console.log('🟢 [DASHBOARD] Resposta recebida:', response);

        if (response && response.success && response.data) {
          const data = response.data;
          console.log('🟢 [DASHBOARD] Dados extraídos:', data);

          this.stats = {
            totalServers: data.servers.total,
            totalDocuments: data.documents.total,
            recentUploads: data.activities.uploads_today,
            pendingReviews: data.servers.this_month,
            storageUsed: Math.round((data.storage.used / (1024 * 1024 * 1024)) * 10) / 10,
            storageLimit: Math.round((data.storage.total / (1024 * 1024 * 1024)) * 10) / 10,
            viewsToday: data.activities.views_today || 0,
            downloadsToday: data.activities.downloads_today || 0
          };
          console.log('✅ Dashboard Stats Carregado:', this.stats);
        } else {
          console.warn('⚠️ [DASHBOARD] Resposta inválida:', response);
        }
      },
      error => {
        console.error('❌ [DASHBOARD] Erro ao carregar estatísticas:', error);
      }
    );
  }

  onSearch() {
    if (this.searchTerm.trim()) {
      console.log('Searching for:', this.searchTerm);
      // Implementar busca
    }
  }

  loadRecentActivities() {
    console.log('🔵 [DASHBOARD] Carregando atividades recentes...');

    this.documentsService.getRecentActivities(10).subscribe({
      next: (response: any) => {
        console.log('🟢 [DASHBOARD] Atividades recebidas:', response);

        if (response && response.success && response.data) {
          // Converter timestamps para Date objects
          this.recentActivities = response.data.map((activity: any) => {
            // Garantir que a string de data seja tratada como UTC
            let timestampStr = activity.timestamp;
            if (timestampStr && !timestampStr.endsWith('Z')) {
              timestampStr += 'Z';
            }
            return {
              ...activity,
              timestamp: new Date(timestampStr)
            };
          });
          console.log('✅ [DASHBOARD] Atividades carregadas:', this.recentActivities.length);
        } else {
          console.warn('⚠️ [DASHBOARD] Resposta de atividades inválida:', response);
        }
      },
      error: (error) => {
        console.error('❌ [DASHBOARD] Erro ao carregar atividades:', error);
        // Manter array vazio em caso de erro
        this.recentActivities = [];
      }
    });
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
    const now = Date.now();
    const activityTime = date.getTime();

    // Calcular diferença. Se negativo (futuro), tratar como zero (agora)
    // Isso resolve problemas de fuso horário ou pequenas desincronias de relógio
    const diff = Math.max(0, now - activityTime);

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) {
      return 'agora mesmo';
    } else if (minutes < 60) {
      return `${minutes} min atrás`;
    } else if (hours < 24) {
      return `${hours} ${hours === 1 ? 'hora' : 'horas'} atrás`;
    } else {
      return `${days} ${days === 1 ? 'dia' : 'dias'} atrás`;
    }
  }

  getStoragePercentage(): number {
    if (this.stats.storageLimit === 0) return 0;
    return (this.stats.storageUsed / this.stats.storageLimit) * 100;
  }

  navigateToActivity(activity: RecentActivity) {
    // Implementar navegação para detalhes da atividade
    console.log('Navigating to activity:', activity);
  }

  refreshData() {
    this.isRefreshing = true;

    forkJoin({
      stats: this.documentsService.getDashboardStats(),
      activities: this.documentsService.getRecentActivities(10),
      storage: this.documentsService.getDriveStorageInfo(),
      recentDocs: this.documentsService.getRecentDocuments(6)
    }).pipe(
      finalize(() => this.isRefreshing = false)
    ).subscribe({
      next: (results: any) => {
        // Update Stats
        if (results.stats && results.stats.success && results.stats.data) {
          const data = results.stats.data;
          this.stats = {
            totalServers: data.servers.total,
            totalDocuments: data.documents.total,
            recentUploads: data.activities.uploads_today,
            pendingReviews: data.servers.this_month,
            storageUsed: Math.round((data.storage.used / (1024 * 1024 * 1024)) * 10) / 10,
            storageLimit: Math.round((data.storage.total / (1024 * 1024 * 1024)) * 10) / 10,
            viewsToday: data.activities.views_today || 0,
            downloadsToday: data.activities.downloads_today || 0
          };
        }

        // Update Recent Documents
        if (results.recentDocs && results.recentDocs.success && results.recentDocs.data) {
          this.recentDocuments = results.recentDocs.data;
        }

        // Update Activities
        if (results.activities && results.activities.success && results.activities.data) {
          this.recentActivities = results.activities.data.map((activity: any) => {
            let timestampStr = activity.timestamp;
            if (timestampStr && !timestampStr.endsWith('Z')) {
              timestampStr += 'Z';
            }
            return {
              ...activity,
              timestamp: new Date(timestampStr)
            };
          });
        }

        // Update Storage
        if (results.storage && results.storage.success && results.storage.data) {
          this.storageUsed = results.storage.data.used;
          this.storageTotal = results.storage.data.total;
        }
      },
      error: (error) => {
        console.error('❌ [DASHBOARD] Erro ao atualizar dados:', error);
      }
    });
  }

  navigateToServer(serverId: string) {
    this.router.navigate(['/servers', serverId]);
  }

  viewDocument(doc: any) {
    console.log('👁️ [DASHBOARD] Visualizando documento:', doc);

    // Fallback: Se não tiver googleDriveId mas o ID for 'drive_XXX', extrair
    if (!doc.googleDriveId && typeof doc.id === 'string' && doc.id.startsWith('drive_')) {
      doc.googleDriveId = doc.id.replace('drive_', '');
    }

    // Abrir URL do documento imediatamente para melhor UX
    if (doc.filePath) {
      window.open(doc.filePath, '_blank');
    } else if (doc.googleDriveId) {
      window.open(`https://drive.google.com/file/d/${doc.googleDriveId}/view`, '_blank');
    } else if (doc.drive_url) {
      window.open(doc.drive_url, '_blank');
    } else {
      alert('URL do documento não encontrada');
    }

    // Sanitizar nome do arquivo antes de logar
    let logFileName = doc.title || doc.fileName || 'Documento';
    if (logFileName.trim() === '.') logFileName = 'Documento Visualizado';

    // Registrar visualização e atualizar lista
    this.documentsService.logView({
      documentId: doc.id,
      driveFileId: doc.googleDriveId || doc.drive_file_id, // Fallback para diferentes formatos
      fileName: logFileName
    }).subscribe({
      next: () => {
        // Atualizar lista de recentes após o log ser confirmado
        this.loadRecentDocuments();
        this.loadRecentActivities(); // Atualizar atividades também
      },
      error: (err) => console.error('Erro ao registrar view:', err)
    });
  }

  downloadDocument(doc: any) {
    console.log('⬇️ [DASHBOARD] Baixando documento:', doc);

    // Use correct ID for download (support virtual Drive IDs)
    let downloadId = doc.id;
    if (!downloadId && doc.googleDriveId) {
      downloadId = `drive_${doc.googleDriveId}`;
    }

    this.documentsService.downloadDocument(downloadId).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.title || 'documento';
        link.click();
        window.URL.revokeObjectURL(url);

        // Atualizar listas após download total
        this.loadRecentDocuments();
        this.loadRecentActivities();
      },
      error: (err: any) => {
        console.error('Erro ao baixar', err);
        alert('Erro ao baixar documento. Tente novamente.');
      }
    });
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  private fetchStorageInfo(): void {
    console.log('🚀 fetchStorageInfo iniciado');
    this.documentsService.getDriveStorageInfo().subscribe({
      next: (response) => {
        console.log('✅ Resposta recebida do armazenamento:', response);
        if (response.success && response.data) {
          console.log('📦 Dados de armazenamento encontrados:', response.data);
          this.storageUsed = response.data.used;
          this.storageTotal = response.data.total;
          console.log('💾 Valores de armazenamento atribuídos - Usado:', this.storageUsed, 'Total:', this.storageTotal);
        } else {
          console.warn('⚠️ Resposta de armazenamento sem sucesso ou sem dados:', response);
        }
      },
      error: (err) => {
        console.error('❌ Erro ao carregar informações de armazenamento:', err);
      },
    });
  }
}