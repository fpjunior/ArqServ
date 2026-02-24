import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-download-loading-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="visible" class="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center">
      <div class="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 text-center transform transition-all animate-fade-in">
        <!-- Ícone animado -->
        <div class="w-16 h-16 mx-auto mb-4 relative">
          <div class="absolute inset-0 rounded-full border-4 border-blue-100"></div>
          <div class="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <svg class="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </div>
        </div>

        <!-- Texto -->
        <h3 class="text-lg font-semibold text-gray-800 mb-1">Baixando arquivo</h3>
        <p class="text-sm text-gray-500 mb-1">{{ fileName || 'Aguarde...' }}</p>
        <p class="text-xs text-gray-400">Isso pode levar alguns segundos</p>
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
export class DownloadLoadingModalComponent {
  @Input() visible = false;
  @Input() fileName = '';
}
