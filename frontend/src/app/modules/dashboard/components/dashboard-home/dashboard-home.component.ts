import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService, User } from '../../../../shared/services/auth.service';
import { DocumentsService } from '../../../../services/documents.service';
import { DocumentViewerService, ViewerState } from '../../../../services/document-viewer.service';
import { ModalWindowService } from '../../../../services/modal-window.service';
import { forkJoin, Subject, Subscription } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

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
  serverName?: string;
  municipalityName?: string;
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
export class DashboardHomeComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
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

  // Modal State - agora gerenciado pelo DocumentViewerService
  isModalVisible = false;
  selectedFile: any | null = null;
  modalViewerUrl: SafeResourceUrl | null = null;
  modalIsLoading = false;
  private viewerStateSubscription: Subscription | null = null;

  // Flag para prevenir duplo clique
  private isOpeningDocument = false;

  // PROTEÇÃO DE EMERGÊNCIA: contador de cliques para detectar travamento
  private clickCount = 0;
  private lastClickTime = 0;

  constructor(
    private documentsService: DocumentsService,
    private authService: AuthService,
    public router: Router,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private documentViewerService: DocumentViewerService,
    public modalWindowService: ModalWindowService
  ) {
    // PROTEÇÃO: Se usuário clicar 3x em 2 segundos sem resposta, forçar reset
    if (typeof window !== 'undefined') {
      window.addEventListener('click', this.emergencyResetHandler.bind(this), true);
    }
  }

  ngOnInit() {
    console.log('🔵 [DASHBOARD-HOME] ngOnInit chamado');
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.currentUser = user;
    });

    // Assinar estado do viewer
    this.viewerStateSubscription = this.documentViewerService.state$.subscribe(state => {
      this.isModalVisible = state.isVisible;
      this.modalViewerUrl = state.viewerUrl;
      this.modalIsLoading = state.isLoading;
      // Nota: Removido cdr.detectChanges() - causava travamento em mobile
    });

    // Assinar eventos de limpeza forçada
    this.documentViewerService.forceCleanup$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      console.log('🚨 [DASHBOARD-HOME] Limpeza forçada recebida');
      this.selectedFile = null;
    });

    this.loadDashboardStats();
    this.loadRecentActivities();
    this.loadRecentDocuments();
    this.fetchStorageInfo();
    this.currentUser = this.authService.getCurrentUser();
  }

  loadRecentDocuments() {
    console.log('🔵 [DASHBOARD] Carregando documentos recentes...');
    this.documentsService.getRecentDocuments(6).pipe(takeUntil(this.destroy$)).subscribe({ // Requesting more to allow for filtering
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
                folderName: doc.folderName || null,
                serverName: doc.serverName || null
              };
            })
            .slice(0, 6); // Take top 6 FINAL VALID documents

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

    this.documentsService.getDashboardStats().pipe(takeUntil(this.destroy$)).subscribe(
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

    this.documentsService.getRecentActivities(10).pipe(takeUntil(this.destroy$)).subscribe({
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

  /**
   * Abre documento usando o serviço centralizado para gerenciamento de memória.
   * O serviço cuida automaticamente de limpar documentos anteriores.
   * PROTEÇÃO: Previne duplo clique
   */
  async viewDocument(doc: any) {
    // Proteção contra duplo clique
    if (this.isOpeningDocument) {
      console.warn('⚠️ [DASHBOARD] Abertura já em andamento, ignorando...');
      return;
    }

    this.isOpeningDocument = true;
    console.log('👁️ [DASHBOARD] Visualizando documento:', doc);

    try {
      // Fallback: Se não tiver googleDriveId mas o ID for 'drive_XXX', extrair
      if (!doc.googleDriveId && typeof doc.id === 'string' && doc.id.startsWith('drive_')) {
        doc.googleDriveId = doc.id.replace('drive_', '');
      }

      // Guardar referência do arquivo selecionado para exibição de metadados
      this.selectedFile = doc;

      // Determinar ID e URL para visualização
      const driveId = doc.googleDriveId || doc.drive_file_id;
      let customUrl: string | undefined;

      if (!driveId) {
        // Tentar URLs alternativas
        if (doc.webViewLink) {
          customUrl = doc.webViewLink.replace('/view', '/preview');
        } else if (doc.filePath) {
          customUrl = doc.filePath;
        } else {
          console.error('Nenhuma URL de visualização encontrada para o documento');
          return;
        }
      }

      // Usar serviço centralizado para abrir documento
      // O serviço cuida automaticamente da limpeza de memória
      const title = doc.title || doc.fileName || 'Documento';
      await this.documentViewerService.openDocument(
        driveId || 'custom',
        title,
        driveId ? undefined : customUrl
      );

      // Registrar visualização
      this.logView(doc);
    } finally {
      // Liberar flag após um pequeno delay
      setTimeout(() => {
        this.isOpeningDocument = false;
      }, 300);
    }
  }

  /**
   * Registra a visualização do documento
   */
  private logView(doc: any) {
    // Sanitizar nome do arquivo antes de logar
    let logFileName = doc.title || doc.fileName || 'Documento';
    if (logFileName.trim() === '.') logFileName = 'Documento Visualizado';

    // Registrar visualização (sem recarregar listas para economizar memória no mobile)
    this.documentsService.logView({
      documentId: doc.id,
      driveFileId: doc.googleDriveId || doc.drive_file_id,
      fileName: logFileName
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => console.log('✅ View registrada com sucesso'),
      error: (err) => console.error('Erro ao registrar view:', err)
    });
  }

  /**
   * Fecha o modal usando o serviço centralizado
   */
  closeModal(): void {
    console.log('🔒 [DASHBOARD-HOME] Usuário fechou modal');
    this.selectedFile = null;
    this.isOpeningDocument = false;
    this.documentViewerService.closeViewer();
  }

  ngOnDestroy() {
    console.log('🗑️ [DASHBOARD-HOME] ngOnDestroy - Limpando subscriptions');
    
    // Remover listener de emergência
    if (typeof window !== 'undefined') {
      window.removeEventListener('click', this.emergencyResetHandler.bind(this), true);
    }

    this.destroy$.next();
    this.destroy$.complete();

    // Cancelar subscription do viewer
    if (this.viewerStateSubscription) {
      this.viewerStateSubscription.unsubscribe();
    }

    // Garantir que modal está fechado e memória liberada
    this.isOpeningDocument = false;
    this.documentViewerService.forceReset();
    this.selectedFile = null;
  }

  /**
   * PROTEÇÃO DE EMERGÊNCIA: Se usuário clicar várias vezes sem resposta, força reset
   */
  private emergencyResetHandler(event: Event): void {
    const now = Date.now();
    
    // Se cliques rápidos (menos de 2s entre eles)
    if (now - this.lastClickTime < 2000) {
      this.clickCount++;
      
      // Se 3 ou mais cliques em 2 segundos
      if (this.clickCount >= 3) {
        console.warn('🚨 [EMERGÊNCIA] Detectado travamento! Forçando reset...');
        this.isOpeningDocument = false;
        this.documentViewerService.forceReset();
        this.clickCount = 0;
        
        // Feedback visual
        if (typeof window !== 'undefined' && window.navigator && 'vibrate' in window.navigator) {
          window.navigator.vibrate(200);
        }
      }
    } else {
      // Resetar contador se passou mais de 2s
      this.clickCount = 1;
    }
    
    this.lastClickTime = now;
  }



  modalIoLoaded() {
    this.modalIsLoading = false;
  }

  getFileIcon(file: any): string {
    if (file.icon) return file.icon;
    // Fallback caso não tenha ícone definido
    const name = (file.title || file.name || '').toLowerCase();
    if (name.includes('pdf')) return '📕';
    if (name.includes('xls') || name.includes('sheet')) return '📊';
    if (name.includes('doc') || name.includes('word')) return '📝';
    if (name.includes('jpg') || name.includes('png') || name.includes('img')) return '🖼️';
    return '📄';
  }

  downloadDocument(doc: any) {
    console.log('⬇️ [DASHBOARD] Baixando documento:', doc);

    // Normalizar ID do Google Drive
    let driveId = doc.googleDriveId;
    if (!driveId && typeof doc.id === 'string' && doc.id.startsWith('drive_')) {
      driveId = doc.id.replace('drive_', '');
    }


    // 1. Prioridade: Download direto do Google Drive (mais rápido e garantido)
    if (driveId) {
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;
      console.log('🔗 Iniciando download direto do Drive:', downloadUrl);

      // Usar link oculto para download direto sem abrir nova aba
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = doc.title || doc.name || 'documento';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Registrar log de download
      this.documentsService.logDownload(doc.id).subscribe({
        next: () => console.log('✅ Log de download registrado'),
        error: err => console.warn('⚠️ Falha ao logar download:', err)
      });
      return;
    }

    // 2. Fallback: Se tiver link de conteúdo web (comum na API do Drive)
    if (doc.webContentLink) {
      const link = document.createElement('a');
      link.href = doc.webContentLink;
      link.download = doc.title || doc.name || 'documento';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.documentsService.logDownload(doc.id).subscribe();
      return;
    }

    // 3. Legado: Download via Proxy do Backend (para arquivos locais ou antigos)
    let downloadId = doc.id;
    this.documentsService.downloadDocument(downloadId).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.title || doc.name || 'documento';
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
    this.documentsService.getDriveStorageInfo().pipe(takeUntil(this.destroy$)).subscribe({
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