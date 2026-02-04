import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../shared/services/auth.service';
import { DocumentsService } from '../../../../services/documents.service';
import { DocumentViewerService } from '../../../../services/document-viewer.service';
import { ModalWindowService } from '../../../../services/modal-window.service';
import { environment } from '../../../../../environments/environment';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Location } from '@angular/common';
import { ConfirmDeleteModalComponent } from '../../../../shared/components/confirm-delete-modal/confirm-delete-modal.component';
import { SuccessModalComponent } from '../../../../shared/components/success-modal/success-modal.component';
import { Subscription } from 'rxjs';

interface ServerFile {
  id: number;
  title: string;
  file_name: string;
  description?: string;
  category?: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
  google_drive_id?: string;
  drive_file_id?: string;
  drive_url?: string;
}

interface Server {
  id: number;
  name: string;
  municipality_code?: string;
  municipality_name?: string;
  created_at?: string;
}

interface ApiResponse {
  success: boolean;
  data: ServerFile[];
  server?: Server;
  message?: string;
}

@Component({
  selector: 'app-server-details',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDeleteModalComponent, SuccessModalComponent],
  templateUrl: './server-details.component.html',
  styleUrls: ['./server-details.component.scss']
})
export class ServerDetailsComponent implements OnInit, OnDestroy {
  server: Server | null = null;
  files: ServerFile[] = [];
  searchTerm: string = '';
  filteredFiles: ServerFile[] = [];
  letter: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';

  // Modal state - integrado diretamente
  isModalVisible = false;
  selectedFile: ServerFile | null = null;
  modalViewerUrl: SafeResourceUrl | null = null;
  modalIsLoading = false;

  // Confirm delete modal
  confirmDeleteModalVisible = false;
  fileToDelete: ServerFile | null = null;

  // Success modal
  successModalVisible: boolean = false;
  successMessage: string = '';

  // Subscription do viewer
  private viewerStateSubscription: Subscription | null = null;

  // Flag para prevenir duplo clique
  private isOpeningDocument = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private documentsService: DocumentsService,
    private sanitizer: DomSanitizer,
    private location: Location,
    private cdr: ChangeDetectorRef,
    private documentViewerService: DocumentViewerService,
    public modalWindowService: ModalWindowService
  ) { }

  ngOnInit(): void {
    const serverId = this.route.snapshot.params['id'];
    this.letter = this.route.snapshot.params['letter'] || '';

    // Validação: se o ID é um código de município (7 dígitos) ou não numérico, redirecionar
    if (!serverId || isNaN(Number(serverId)) || serverId.length === 7) {
      console.warn(`⚠️ ID inválido para servidor: ${serverId}. Redirecionando para listagem.`);
      this.router.navigate(['/servers']);
      return;
    }

    // Validação adicional: se letter é "municipality", também redirecionar
    if (this.letter === 'municipality') {
      console.warn(`⚠️ Rota incorreta detectada: /servers/municipality/${serverId}. Redirecionando.`);
      this.router.navigate(['/servers']);
      return;
    }

    // Assinar estado do viewer
    this.viewerStateSubscription = this.documentViewerService.state$.subscribe(state => {
      this.isModalVisible = state.isVisible;
      this.modalViewerUrl = state.viewerUrl;
      this.modalIsLoading = state.isLoading;
      // Nota: Removido cdr.detectChanges() - causava travamento em mobile
    });

    this.loadServerFiles(serverId);
  }

  loadServerFiles(serverId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    const token = this.authService.getToken();
    if (!token) {
      this.errorMessage = 'Token de autenticação não encontrado';
      this.isLoading = false;
      return;
    }

    console.log(`🔍 Carregando documentos para servidor ID: ${serverId}`);

    this.http.get<ApiResponse>(`${environment.apiUrl}/documents/server/${serverId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (response) => {
        console.log('📡 Resposta da API:', response);

        if (response.success) {
          this.files = response.data;
          this.server = response.server || null;
          this.filterFiles();
          console.log(`✅ ${this.files.length} documentos carregados para ${this.server?.name}`);
        } else {
          this.errorMessage = response.message || 'Erro ao carregar documentos';
          console.error('❌ Erro na resposta da API:', response.message);
        }

        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Erro na requisição:', error);
        this.errorMessage = 'Erro ao carregar documentos do servidor';
        this.isLoading = false;
      }
    });
  }

  filterFiles(): void {
    if (!this.searchTerm.trim()) {
      this.filteredFiles = this.files;
    } else {
      const searchLower = this.searchTerm.toLowerCase();
      this.filteredFiles = this.files.filter(file =>
        file.title.toLowerCase().includes(searchLower) ||
        file.file_name.toLowerCase().includes(searchLower) ||
        (file.description && file.description.toLowerCase().includes(searchLower))
      );
    }
  }

  onSearch(): void {
    this.filterFiles();
  }

  /**
   * Visualiza documento usando o serviço centralizado
   * PROTEÇÃO: Previne duplo clique
   */
  async viewDocument(file: ServerFile): Promise<void> {
    // Proteção contra duplo clique
    if (this.isOpeningDocument) {
      console.warn('⚠️ [SERVER-DETAILS] Abertura já em andamento, ignorando...');
      return;
    }

    this.isOpeningDocument = true;
    console.log('🆕 ViewDocument chamado:', file);

    try {
      // IMPORTANTE: Limpar seleção anterior primeiro
      this.selectedFile = null;

      // Obter ID do Drive
      const driveFileId = file.drive_file_id || file.google_drive_id;

      if (!driveFileId) {
        console.error('❌ Nenhum ID do Google Drive encontrado para o arquivo:', file);
        return;
      }

      // Guardar referência do arquivo para exibição de metadados
      this.selectedFile = file;

      // Usar serviço centralizado para abrir documento
      await this.documentViewerService.openDocument(
        driveFileId,
        file.title || file.file_name
      );

      // Registrar visualização
      console.log('👁️ Registrando visualização...');
      this.documentsService.logView({
        documentId: file.id,
        driveFileId: driveFileId,
        fileName: file.file_name || file.title,
        municipalityCode: this.server?.municipality_code
      }).subscribe({
        next: (res) => console.log('✅ logView sucesso:', res),
        error: (err) => console.error('❌ logView erro:', err)
      });
    } finally {
      // Liberar flag após um pequeno delay
      setTimeout(() => {
        this.isOpeningDocument = false;
      }, 300);
    }
  }

  downloadDocument(file: ServerFile): void {
    console.log(`⬇️ Iniciando download de: ${file.title}`);

    const driveFileId = file.drive_file_id || file.google_drive_id;
    if (!driveFileId) {
      alert('Arquivo não disponível para download');
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      alert('Token de autenticação não encontrado');
      return;
    }

    // Usar endpoint de download específico para Google Drive
    this.http.get(`${environment.apiUrl}/documents/drive/${driveFileId}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      responseType: 'blob',
      observe: 'response'
    }).subscribe({
      next: (response) => {
        console.log('✅ Download concluído');

        // Criar URL para o blob e fazer download
        const blob = response.body;
        if (blob) {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = file.file_name || file.title;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }
      },
      error: (error) => {
        console.error('❌ Erro no download:', error);
        alert('Erro ao fazer download do arquivo');
      }
    });
  }

  /**
   * Remover documento
   */
  showDeleteModal(file: ServerFile): void {
    this.fileToDelete = file;
    this.confirmDeleteModalVisible = true;
  }

  onDeleteConfirmed(): void {
    if (!this.fileToDelete) return;
    this.isLoading = true;
    this.errorMessage = '';
    this.http.delete(`${environment.apiUrl}/documents/${this.fileToDelete.id}`, {
      headers: {
        Authorization: `Bearer ${this.authService.getToken()}`
      }
    }).subscribe({
      next: () => {
        this.files = this.files.filter(f => f.id !== this.fileToDelete!.id);
        this.filteredFiles = this.filteredFiles.filter(f => f.id !== this.fileToDelete!.id);
        this.confirmDeleteModalVisible = false;
        this.fileToDelete = null;

        // Exibir modal de sucesso
        this.successMessage = 'Documento removido com sucesso!';
        this.successModalVisible = true;

        // Fechar modal automaticamente após 3 segundos
        setTimeout(() => {
          this.successModalVisible = false;
        }, 3000);
      },
      error: (error) => {
        console.error('Erro ao remover documento:', error);
        this.errorMessage = 'Erro ao remover documento. Tente novamente mais tarde.';
        this.confirmDeleteModalVisible = false;
        this.fileToDelete = null;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  onDeleteModalClosed(): void {
    this.confirmDeleteModalVisible = false;
    this.fileToDelete = null;
  }

  getFileIcon(file: ServerFile): string {
    const mimeType = file.mime_type?.toLowerCase() || '';

    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return '📊';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📋';
    if (mimeType.includes('text')) return '📄';

    return '📎'; // Arquivo genérico
  }

  formatFileSize(sizeInBytes: number | undefined): string {
    if (!sizeInBytes) return 'Tamanho desconhecido';

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = sizeInBytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('pt-BR');
  }

  goBack(): void {
    this.location.back();
  }

  /**
   * Fecha o modal usando o serviço centralizado
   */
  closeModal(): void {
    console.log('🔒 [SERVER-DETAILS] Fechando modal');
    this.selectedFile = null;
    this.isOpeningDocument = false; // Resetar flag
    // Não usar await - deixar o serviço fazer a limpeza em background
    this.documentViewerService.closeViewer();
  }

  ngOnDestroy(): void {
    console.log('🗑️ [SERVER-DETAILS] ngOnDestroy - Limpando memória');

    // Cancelar subscription do viewer
    if (this.viewerStateSubscription) {
      this.viewerStateSubscription.unsubscribe();
    }

    // Garantir que modal está fechado e memória liberada
    this.isOpeningDocument = false;
    this.documentViewerService.forceReset();
    this.selectedFile = null;
  }
}