import { Component, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';

// Angular Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

// Services
import { DocumentsService } from '../../services/documents.service';

interface Municipality {
  code: string;
  name: string;
  state: string;
}

@Component({
  selector: 'app-municipality-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './municipality-dialog.component.html',
  styleUrl: './municipality-dialog.component.scss'
})
export class MunicipalityDialogComponent {
  @Output() municipalityCreated = new EventEmitter<Municipality>();
  @Output() cancelled = new EventEmitter<void>();

  municipalityForm: FormGroup;
  isCreating = false;

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private documentsService: DocumentsService
  ) {
    this.municipalityForm = this.fb.group({
      code: [''],
      name: ['', [Validators.required, Validators.minLength(2)]],
      state: ['', Validators.required]
    });
  }

  async onCreate(): Promise<void> {
    if (this.municipalityForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isCreating = true;

    try {
      const municipalityData: Municipality = {
        code: this.municipalityForm.get('code')?.value || this.generateMunicipalityCode(),
        name: this.municipalityForm.get('name')?.value,
        state: this.municipalityForm.get('state')?.value
      };

      // TODO: Integrar com API para criar município
      await this.createMunicipalityAPI(municipalityData);

      this.snackBar.open('Município criado com sucesso!', 'Fechar', {
        duration: 3000,
        panelClass: ['snackbar-success']
      });

      this.municipalityCreated.emit(municipalityData);

    } catch (error: any) {
      this.snackBar.open(`Erro ao criar município: ${error.message}`, 'Fechar', {
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
    Object.keys(this.municipalityForm.controls).forEach(key => {
      this.municipalityForm.get(key)?.markAsTouched();
    });
  }

  private generateMunicipalityCode(): string {
    // Gera um código único baseado em timestamp e random
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 10);
    return timestamp + random;
  }

  private async createMunicipalityAPI(municipality: Municipality): Promise<void> {
    return new Promise((resolve, reject) => {
      this.documentsService.createMunicipality(municipality).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Atualizar com dados retornados do servidor
            municipality.code = response.data.code || municipality.code;
            resolve();
          } else {
            reject(new Error(response.message || 'Erro ao criar município'));
          }
        },
        error: (error) => {
          console.error('Erro na API de município:', error);
          reject(new Error('Erro ao criar município. Tente novamente.'));
        }
      });
    });
  }
}
