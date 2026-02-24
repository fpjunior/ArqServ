import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface DocumentFile {
  id: string;
  title: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  drive_file_id?: string;
  google_drive_id?: string;
  drive_url?: string;
}

@Component({
  selector: 'app-document-viewer-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" (click)="onBackdropClick($event)">
      <div class="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b">
          <div class="flex items-center space-x-3">
            <div class="text-2xl">{{ getFileIcon() }}</div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">{{ file?.title }}</h3>
              <p class="text-sm text-gray-500">{{ file?.file_name }} {{ getFileSizeText() }}</p>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <!-- Botão fullscreen -->
            <button 
              (click)="openFullscreen()" 
              class="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              type="button"
              title="Abrir em tela cheia"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
              </svg>
            </button>
            <button 
              (click)="close()" 
              class="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              type="button"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Viewer Content -->
        <div class="flex-1 p-4 overflow-hidden bg-gray-100">
          <div *ngIf="isLoading" class="flex flex-col items-center justify-center h-96">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <span class="text-gray-600">Carregando documento...</span>
            <span *ngIf="isLargeFile" class="text-sm text-gray-500 mt-2">Arquivo grande - pode demorar um pouco</span>
          </div>

          <!-- Visualizador principal -->
          <div *ngIf="!isLoading && viewerUrl && !viewerError" class="h-full min-h-[600px]">
            <iframe 
              [src]="viewerUrl" 
              class="w-full h-full border-0 rounded bg-white"
              frameborder="0"
              allow="autoplay"
              (load)="onIframeLoad()"
              (error)="onIframeError()"
            ></iframe>
          </div>

          <!-- Mensagem para arquivos grandes que não podem ser visualizados -->
          <div *ngIf="!isLoading && (viewerError || !viewerUrl)" class="flex flex-col items-center justify-center h-96">
            <div class="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
              <div class="text-6xl mb-4">{{ getFileIcon() }}</div>
              <h4 class="text-xl font-semibold text-gray-800 mb-2">{{ file?.title }}</h4>
              <p class="text-gray-600 mb-4">
                {{ isLargeFile ? 'Este arquivo é muito grande para visualização no navegador.' : 'Não foi possível carregar a visualização.' }}
              </p>
              <p class="text-sm text-gray-500 mb-6" *ngIf="isLargeFile">
                Arquivos acima de 100MB precisam ser baixados para visualização.
              </p>
              <div class="flex flex-col space-y-3">
                <button 
                  (click)="downloadDocument()" 
                  class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center"
                >
                  <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  Baixar Arquivo {{ getFileSizeText() }}
                </button>
                <button 
                  (click)="openInGoogleDrive()" 
                  class="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"
                >
                  <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.71 3.5L1.15 15l3.43 6 6.55-11.5L7.71 3.5zm2.58 12L7.44 20h13.12l2.86-5H10.29zm12.57-1L14.85 3.5H8.29l6.01 10.5 6.56.5z"/>
                  </svg>
                  Abrir no Google Drive
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between p-4 border-t bg-gray-50 rounded-b-lg">
          <div class="text-sm text-gray-600">
            <span *ngIf="file?.mime_type">{{ getMimeTypeLabel() }}</span>
            <span *ngIf="isLargeFile" class="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">Arquivo Grande</span>
          </div>
          <div class="flex space-x-3">
            <button 
              (click)="tryAlternativeViewer()" 
              *ngIf="!viewerError && viewerUrl"
              class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              type="button"
            >
              Problemas? Tentar outro viewer
            </button>
            <button 
              (click)="downloadDocument()" 
              class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center"
              type="button"
            >
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
              </svg>
              Baixar
            </button>
            <button 
              (click)="close()" 
              class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              type="button"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    iframe {
      min-height: 600px;
    }
  `]
})
export class DocumentViewerModalComponent implements OnChanges {
  @Input() isVisible = false;
  @Input() file: DocumentFile | null = null;
  @Output() closeModal = new EventEmitter<void>();
  @Output() downloadFile = new EventEmitter<DocumentFile>();

  isLoading = true;
  viewerUrl: SafeResourceUrl | null = null;
  viewerError = false;
  currentViewerType = 0; // 0 = Google Docs Viewer, 1 = Drive Preview, 2 = Drive Embed
  loadTimeout: any = null;
  
  // Limite de 100MB para visualização (limitação do Google)
  private readonly LARGE_FILE_THRESHOLD = 100 * 1024 * 1024;

  constructor(private sanitizer: DomSanitizer) {}

  get isLargeFile(): boolean {
    return (this.file?.file_size || 0) > this.LARGE_FILE_THRESHOLD;
  }

  ngOnChanges(): void {
    if (this.isVisible && this.file) {
      this.viewerError = false;
      this.currentViewerType = 0;
      this.loadDocument();
    }
  }

  loadDocument(): void {
    if (!this.file) return;

    // Limpar timeout anterior se existir
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
    }

    this.isLoading = true;
    this.viewerUrl = null;

    const driveFileId = this.file.drive_file_id || this.file.google_drive_id;
    
    if (!driveFileId) {
      this.isLoading = false;
      this.viewerError = true;
      return;
    }

    // Para arquivos muito grandes, não tentar visualizar - ir direto para download
    if (this.isLargeFile) {
      console.log('📦 Arquivo grande detectado, mostrando opções de download');
      this.isLoading = false;
      this.viewerError = true;
      return;
    }

    // Tentar diferentes viewers em ordem de preferência
    const embedUrl = this.getViewerUrl(driveFileId, this.currentViewerType);
    console.log('🔗 Viewer URL:', embedUrl);
    this.viewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);

    // Timeout para considerar erro se não carregar
    setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
      }
    }, 3000);
  }

  private getViewerUrl(fileId: string, viewerType: number): string {
    switch (viewerType) {
      case 0:
        // Google Docs Viewer - geralmente funciona melhor
        return `https://docs.google.com/viewer?srcid=${fileId}&pid=explorer&efh=false&a=v&chrome=false&embedded=true`;
      case 1:
        // Google Drive Preview
        return `https://drive.google.com/file/d/${fileId}/preview`;
      case 2:
        // Google Drive Direct Embed
        return `https://drive.google.com/uc?id=${fileId}&export=view`;
      default:
        return `https://drive.google.com/file/d/${fileId}/preview`;
    }
  }

  tryAlternativeViewer(): void {
    if (!this.file) return;
    
    const driveFileId = this.file.drive_file_id || this.file.google_drive_id;
    if (!driveFileId) return;

    this.currentViewerType = (this.currentViewerType + 1) % 3;
    console.log('🔄 Tentando viewer alternativo:', this.currentViewerType);
    
    const embedUrl = this.getViewerUrl(driveFileId, this.currentViewerType);
    this.viewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  onIframeLoad(): void {
    // Limpar timeout quando iframe carregar com sucesso
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
      this.loadTimeout = null;
    }
    this.isLoading = false;
    console.log('✅ Iframe carregado com sucesso');
  }

  onIframeError(): void {
    console.log('❌ Erro ao carregar iframe');
    this.viewerError = true;
    this.isLoading = false;
  }

  getFileSizeText(): string {
    if (!this.file?.file_size) return '';
    const sizeMB = this.file.file_size / (1024 * 1024);
    if (sizeMB >= 1) {
      return `(${sizeMB.toFixed(1)} MB)`;
    }
    const sizeKB = this.file.file_size / 1024;
    return `(${sizeKB.toFixed(0)} KB)`;
  }

  getMimeTypeLabel(): string {
    if (!this.file?.mime_type) return '';
    const mimeType = this.file.mime_type.toLowerCase();
    
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('image')) return 'Imagem';
    if (mimeType.includes('word')) return 'Word';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'Excel';
    if (mimeType.includes('powerpoint')) return 'PowerPoint';
    
    return this.file.mime_type;
  }

  getFileIcon(): string {
    if (!this.file?.mime_type) return '📄';
    
    const mimeType = this.file.mime_type.toLowerCase();
    
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return '📊';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📋';
    if (mimeType.includes('text')) return '📄';
    
    return '📎';
  }

  openFullscreen(): void {
    const driveFileId = this.file?.drive_file_id || this.file?.google_drive_id;
    if (driveFileId) {
      window.open(`https://drive.google.com/file/d/${driveFileId}/view`, '_blank');
    }
  }

  openInGoogleDrive(): void {
    if (!this.file) return;
    
    const driveFileId = this.file.drive_file_id || this.file.google_drive_id;
    
    if (driveFileId) {
      const driveUrl = `https://drive.google.com/file/d/${driveFileId}/view`;
      console.log('🚀 Abrindo no Google Drive:', driveUrl);
      window.open(driveUrl, '_blank');
    } else if (this.file.drive_url) {
      console.log('🚀 Abrindo URL do Drive:', this.file.drive_url);
      window.open(this.file.drive_url, '_blank');
    } else {
      console.error('❌ Nenhum ID ou URL do Google Drive disponível');
      alert('Não foi possível abrir o documento no Google Drive');
    }
  }

  downloadDocument(): void {
    if (this.file) {
      this.downloadFile.emit(this.file);
    }
  }

  close(): void {
    // Limpar timeout ao fechar
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
      this.loadTimeout = null;
    }
    this.isVisible = false;
    this.viewerUrl = null;
    this.viewerError = false;
    this.isLoading = true;
    this.currentViewerType = 0;
    this.closeModal.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}