import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-delete-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isVisible" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50" (click)="onBackdropClick($event)">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 flex flex-col z-[10000]" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b">
          <h3 class="text-lg font-semibold text-gray-900">Confirmar exclusão</h3>
          <button (click)="close()" class="text-gray-400 hover:text-gray-600 transition-colors" type="button">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <!-- Content -->
        <div class="p-6 text-center">
          <div class="text-4xl mb-2 text-red-500">🗑️</div>
          <p class="text-gray-700 mb-4">Tem certeza que deseja excluir <span class="font-bold">{{ itemName }}</span>?</p>
        </div>
        <!-- Footer -->
        <div class="flex items-center justify-end p-4 border-t bg-gray-50 rounded-b-lg space-x-2">
          <button (click)="close()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors" type="button">Cancelar</button>
          <button (click)="confirm()" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors" type="button">Excluir</button>
        </div>
      </div>
    </div>
  `
})
export class ConfirmDeleteModalComponent {
  @Input() isVisible: boolean = false;
  @Input() itemName: string = '';
  @Output() confirmed = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  close() {
    this.closed.emit();
  }

  confirm() {
    this.confirmed.emit();
  }

  onBackdropClick(event: MouseEvent) {
    this.close();
  }
}
