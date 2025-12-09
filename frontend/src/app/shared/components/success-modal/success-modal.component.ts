import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-success-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="visible" class="success-modal">
      <div class="modal-content">
        <div class="icon-container">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-2 17.414l-5.707-5.707 1.414-1.414L10 14.586l7.293-7.293 1.414 1.414L10 17.414z"/>
          </svg>
        </div>
        <h2 class="modal-title">Sucesso</h2>
        <p class="modal-message">{{ message }}</p>
        <button class="close-button" (click)="closeModal()">Fechar</button>
      </div>
    </div>
  `,
  styles: [
    `
      .success-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }
      .modal-content {
        background: white;
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        animation: slideInUp 0.3s ease-out;
        max-width: 300px;
      }
      .icon-container {
        background: #4caf50;
        color: #ffffff;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        margin: 0 auto 10px;
      }

      .icon-container svg {
        fill: #ffffff; /* Garantir que o ícone seja branco */
        width: 24px;
        height: 24px;
      }
      .modal-title {
        font-size: 18px;
        font-weight: bold;
        color: #333;
        margin-bottom: 10px;
      }
      .modal-message {
        font-size: 14px;
        color: #555;
        margin-bottom: 20px;
      }
      .close-button {
        padding: 8px 16px;
        background: #4caf50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      .close-button:hover {
        background: #45a049;
      }
      @keyframes slideInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `
  ]
})
export class SuccessModalComponent {
  @Input() visible: boolean = false;
  @Input() message: string = '';

  closeModal(): void {
    this.visible = false;
  }
}