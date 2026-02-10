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
    <div *ngIf="isVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" (click)="onBackdropClick($event)">
      <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b">
          <div class="flex items-center space-x-3">
            <div class="text-2xl">{{ getFileIcon() }}</div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">{{ file?.title }}</h3>
              <p class="text-sm text-gray-500">{{ file?.file_name }}</p>
            </div>
          </div>
          <button 
            (click)="close()" 
            class="text-gray-400 hover:text-gray-600 transition-colors"
            type="button"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Viewer Content -->
        <div class="flex-1 p-4 overflow-hidden">
          <div *ngIf="isLoading" class="flex items-center justify-center h-96">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span class="ml-3 text-gray-600">Carregando documento...</span>
          </div>

          <div *ngIf="!isLoading && viewerUrl" class="h-full min-h-[500px]">
            <iframe 
              [src]="viewerUrl" 
              class="w-full h-full border rounded"
              frameborder="0"
              (load)="onIframeLoad()"
            ></iframe>
          </div>

          <div *ngIf="!isLoading && !viewerUrl" class="flex flex-col items-center justify-center h-96 text-gray-500">
            <div class="text-4xl mb-4">📄</div>
            <p class="text-lg mb-2">Não foi possível carregar a visualização</p>
            <p class="text-sm mb-4">Use uma das opções abaixo para acessar o documento</p>
            <div class="flex gap-3">
              <button 
                (click)="openInGoogleDrive()" 
                class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z"/>
                </svg>
                Abrir no Google Drive
              </button>
              <button 
                (click)="downloadDocument()" 
                class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
                Baixar Documento
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between p-4 border-t bg-gray-50 rounded-b-lg">
          <div class="text-sm text-gray-600">
            <span *ngIf="file?.mime_type">Tipo: {{ file?.mime_type }}</span>
          </div>
          <div class="flex space-x-3">
            <button 
              (click)="openInGoogleDrive()" 
              class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              type="button"
            >
              Abrir no Google Drive
            </button>
            <button 
              (click)="downloadDocument()" 
              class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              type="button"
            >
              📥 Baixar
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
      min-height: 500px;
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
  loadTimeout: any = null;
  useAlternativeViewer = false;

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

    // Limpar timeout anterior se existir
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
    }

    this.isLoading = true;
    this.viewerUrl = null;

    const driveFileId = this.file.drive_file_id || this.file.google_drive_id;
    console.log('📁 Using drive file ID:', driveFileId);
    
    if (driveFileId) {
      // ESTRATÉGIA MELHORADA: Usar Google Docs Viewer para arquivos grandes
      // O Google Docs Viewer funciona melhor com arquivos grandes e suporta mais tipos
      let embedUrl: string;
      
      if (this.useAlternativeViewer) {
        // Fallback: Usar visualizador alternativo se o primeiro falhar
        embedUrl = `https://docs.google.com/gview?url=https://drive.google.com/uc?id=${driveFileId}&embedded=true`;
        console.log('🔄 Tentando visualizador alternativo');
      } else {
        // Primeira tentativa: Google Docs Viewer padrão
        embedUrl = `https://drive.google.com/viewer?srcid=${driveFileId}&pid=explorer&efh=false&a=v&chrome=false&embedded=true`;
      }
      
      console.log('🔗 Embed URL:', embedUrl);
      this.viewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
      console.log(`📖 Carregando visualização: ${this.file.title}`);

      // Timeout de segurança: Se não carregar em 15 segundos, tenta alternativa
      this.loadTimeout = setTimeout(() => {
        if (this.isLoading && !this.useAlternativeViewer) {
          console.log('⚠️ Timeout no carregamento, tentando método alternativo...');
          this.useAlternativeViewer = true;
          this.loadDocument();
        }
      }, 15000);
    }

    // Simular carregamento mínimo para melhor UX
    setTimeout(() => {
      this.isLoading = false;
      console.log('✅ Loading finished');
    }, 1000);
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
    // Limpar timeout ao fechar
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
      this.loadTimeout = null;
    }
    this.isVisible = false;
    this.viewerUrl = null;
    this.isLoading = true;
    this.useAlternativeViewer = false;
    this.closeModal.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}