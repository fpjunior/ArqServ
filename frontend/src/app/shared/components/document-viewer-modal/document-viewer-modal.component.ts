import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface DocumentFile {
  id: string;
  title: string;
  file_name: string;
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
    <div *ngIf="isVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-0 sm:p-4" (click)="onBackdropClick($event)">
      <div class="bg-white rounded-none sm:rounded-lg shadow-xl w-full h-full sm:max-w-4xl sm:h-auto sm:max-h-[90vh] flex flex-col" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="flex items-center justify-between p-3 sm:p-4 border-b bg-white">
          <div class="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
            <div class="text-xl sm:text-2xl flex-shrink-0">{{ getFileIcon() }}</div>
            <div class="flex-1 min-w-0">
              <h3 class="text-sm sm:text-lg font-semibold text-gray-900 truncate">{{ file?.title }}</h3>
              <p class="text-xs sm:text-sm text-gray-500 truncate">{{ file?.file_name }}</p>
            </div>
          </div>
          <button 
            (click)="close()" 
            class="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-2"
            type="button"
            aria-label="Fechar"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Viewer Content -->
        <div class="flex-1 overflow-hidden relative">
          <div *ngIf="isLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-white">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span class="mt-3 text-gray-600 text-sm">Carregando documento...</span>
          </div>

          <div *ngIf="!isLoading && viewerUrl" class="w-full h-full">
            <iframe 
              [src]="viewerUrl" 
              class="w-full h-full border-0"
              frameborder="0"
              allowfullscreen
              (load)="onIframeLoad()"
            ></iframe>
          </div>

          <div *ngIf="!isLoading && !viewerUrl" class="flex flex-col items-center justify-center h-full text-gray-500 p-4">
            <div class="text-4xl mb-4">📄</div>
            <p class="text-base sm:text-lg mb-2 text-center">Não foi possível carregar a visualização</p>
            <p class="text-xs sm:text-sm text-center mb-4">Clique no botão abaixo para abrir no Google Drive</p>
            <button 
              (click)="openInGoogleDrive()" 
              class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
            >
              Abrir no Google Drive
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3 sm:p-4 border-t bg-gray-50 gap-2 sm:gap-0">
          <div class="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
            <span *ngIf="file?.mime_type">Tipo: {{ file?.mime_type }}</span>
          </div>
          <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button 
              (click)="openInGoogleDrive()" 
              class="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded hover:bg-gray-100"
              type="button"
            >
              🔗 Abrir no Drive
            </button>
            <button 
              (click)="downloadDocument()" 
              class="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              type="button"
            >
              📥 Baixar
            </button>
            <button 
              (click)="close()" 
              class="px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors sm:hidden"
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
    :host {
      display: contents;
    }
    
    /* Garantir que o iframe ocupe todo o espaço disponível */
    iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: none;
    }
    
    /* Melhorar o scroll no mobile */
    @media (max-width: 640px) {
      iframe {
        -webkit-overflow-scrolling: touch;
      }
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

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    console.log('🔄 Modal ngOnChanges:', { isVisible: this.isVisible, file: this.file });
    if (this.isVisible && this.file) {
      console.log('🚀 Loading document in modal...');
      this.loadDocument();
    }
  }

  loadDocument(): void {
    console.log('📄 LoadDocument called with file:', this.file);
    if (!this.file) return;

    this.isLoading = true;
    this.viewerUrl = null;

    const driveFileId = this.file.drive_file_id || this.file.google_drive_id;
    console.log('📁 Using drive file ID:', driveFileId);
    
    if (driveFileId) {
      // Usar o Google Drive viewer
      const embedUrl = `https://drive.google.com/file/d/${driveFileId}/preview`;
      console.log('🔗 Embed URL:', embedUrl);
      this.viewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
      console.log(`📖 Carregando visualização: ${this.file.title}`);
    }

    // Simular carregamento mínimo para melhor UX
    setTimeout(() => {
      this.isLoading = false;
      console.log('✅ Loading finished');
    }, 1000);
  }

  onIframeLoad(): void {
    this.isLoading = false;
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
    this.isVisible = false;
    this.viewerUrl = null;
    this.isLoading = true;
    this.closeModal.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}