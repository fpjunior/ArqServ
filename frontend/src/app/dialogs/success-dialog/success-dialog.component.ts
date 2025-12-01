import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-success-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div mat-dialog-content class="success-modal">
      <!-- Header com ícone de sucesso -->
      <div class="header">
        <div class="success-icon">
          <mat-icon>check_circle</mat-icon>
        </div>
        <h2 mat-dialog-title class="title">{{ data.title }}</h2>
      </div>
      
      <!-- Conteúdo da mensagem -->
      <div class="content">
        <p class="message">{{ data.message }}</p>
      </div>
      
      <!-- Ações -->
      <div mat-dialog-actions class="actions">
        <button 
          mat-raised-button 
          color="primary" 
          (click)="onClose()"
          class="close-btn">
          <mat-icon>close</mat-icon>
          Fechar
        </button>
      </div>
    </div>
  `,
  styles: [`
    .success-modal {
      padding: 0;
      min-width: 400px;
      max-width: 500px;
    }
    
    .header {
      text-align: center;
      padding: 24px 24px 16px;
      background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
      color: white;
      border-radius: 4px 4px 0 0;
    }
    
    .success-icon {
      margin-bottom: 12px;
    }
    
    .success-icon mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: white;
    }
    
    .title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 500;
    }
    
    .content {
      padding: 24px;
      background: white;
    }
    
    .message {
      margin: 0;
      font-size: 1rem;
      line-height: 1.5;
      color: #424242;
      white-space: pre-line;
    }
    
    .actions {
      padding: 16px 24px 24px;
      text-align: center;
      background: white;
      border-radius: 0 0 4px 4px;
    }
    
    .close-btn {
      min-width: 120px;
    }
    
    .close-btn mat-icon {
      margin-right: 8px;
    }
  `]
})
export class SuccessDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<SuccessDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; message: string }
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }
}