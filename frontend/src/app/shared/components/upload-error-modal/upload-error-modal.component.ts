import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-upload-error-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="visible" class="fixed inset-0 bg-black bg-opacity-60 z-[9999] flex items-center justify-center">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden transform transition-all animate-fade-in">
        <!-- Header vermelho -->
        <div class="bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 text-center text-white">
          <div class="w-12 h-12 mx-auto mb-2 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
            </svg>
          </div>
          <h2 class="text-lg font-bold">Erro no Upload</h2>
          <p class="text-red-100 text-sm">O arquivo não foi enviado</p>
        </div>

        <!-- Conteúdo -->
        <div class="px-6 py-4">
          <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <p class="text-sm text-red-800 font-medium">{{ errorMessage }}</p>
          </div>

          <div *ngIf="fileName" class="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <span class="truncate">{{ fileName }}</span>
          </div>

          <p class="text-xs text-gray-500">
            Tente novamente. Se o problema persistir, verifique sua conexão com a internet ou entre em contato com o suporte.
          </p>
        </div>

        <!-- Ações -->
        <div class="px-6 pb-4 flex gap-3">
          <button (click)="onRetry.emit()"
            class="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2.5 px-4 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 text-sm">
            Tentar Novamente
          </button>
          <button (click)="onClose.emit()"
            class="flex-1 bg-gray-100 text-gray-700 py-2.5 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-all duration-200 text-sm">
            Fechar
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes fade-in {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    .animate-fade-in {
      animation: fade-in 0.2s ease-out;
    }
  `]
})
export class UploadErrorModalComponent {
  @Input() visible = false;
  @Input() errorMessage = 'Ocorreu um erro ao enviar o arquivo. Por favor, tente novamente.';
  @Input() fileName = '';
  @Output() onClose = new EventEmitter<void>();
  @Output() onRetry = new EventEmitter<void>();
}
