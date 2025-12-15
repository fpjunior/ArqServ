import { Component, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';

// Angular Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

// Services
import { DocumentsService, FinancialDocumentType } from '../../services/documents.service';

@Component({
  selector: 'app-financial-type-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './financial-type-dialog.component.html',
  styleUrl: './financial-type-dialog.component.scss'
})
export class FinancialTypeDialogComponent {
  @Output() typeCreated = new EventEmitter<FinancialDocumentType>();
  @Output() cancelled = new EventEmitter<void>();

  typeForm: FormGroup;
  isCreating = false;

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private documentsService: DocumentsService
  ) {
    this.typeForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['']
    });
  }

  async onCreate(): Promise<void> {
    if (this.typeForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isCreating = true;

    try {
      const typeData = {
        name: this.typeForm.get('name')?.value.trim(),
        description: this.typeForm.get('description')?.value?.trim() || undefined
      };

      console.log('📝 [FINANCIAL-TYPE-DIALOG] Criando tipo:', typeData);

      await this.createFinancialTypeAPI(typeData);

      this.snackBar.open('Tipo de documento criado com sucesso!', 'Fechar', {
        duration: 3000,
        panelClass: ['snackbar-success']
      });

    } catch (error: any) {
      console.error('❌ [FINANCIAL-TYPE-DIALOG] Erro:', error);
      this.snackBar.open(`Erro ao criar tipo: ${error.message}`, 'Fechar', {
        duration: 5000,
        panelClass: ['snackbar-error']
      });
    } finally {
      this.isCreating = false;
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.typeForm.controls).forEach(key => {
      this.typeForm.get(key)?.markAsTouched();
    });
  }

  private async createFinancialTypeAPI(typeData: { name: string; description?: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      this.documentsService.createFinancialDocumentType(typeData).subscribe({
        next: (response) => {
          console.log('✅ [FINANCIAL-TYPE-DIALOG] Resposta:', response);
          if (response.success && response.data) {
            this.typeCreated.emit(response.data);
            resolve();
          } else {
            reject(new Error(response.message || 'Erro ao criar tipo de documento'));
          }
        },
        error: (error) => {
          console.error('❌ [FINANCIAL-TYPE-DIALOG] Erro na API:', error);
          reject(new Error('Erro ao criar tipo de documento. Tente novamente.'));
        }
      });
    });
  }
}
