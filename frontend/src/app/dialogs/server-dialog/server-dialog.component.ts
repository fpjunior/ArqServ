import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';

// Angular Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

// Services
import { DocumentsService } from '../../services/documents.service';

interface Server {
  name: string;
  municipality_code: string;
  municipality_name?: string;
}

interface DialogData {
  municipalityCode: string;
  municipalityName: string;
}

@Component({
  selector: 'app-server-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './server-dialog.component.html',
  styleUrl: './server-dialog.component.scss'
})
export class ServerDialogComponent {
  @Input() data: DialogData = { municipalityCode: '', municipalityName: '' };
  @Output() serverCreated = new EventEmitter<Server>();
  @Output() cancelled = new EventEmitter<void>();

  serverForm: FormGroup;
  isCreating = false;

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private documentsService: DocumentsService
  ) {
    this.serverForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  getFirstLetter(): string {
    const name = this.serverForm.get('name')?.value;
    return name ? name.charAt(0).toUpperCase() : 'X';
  }

  async onCreate(): Promise<void> {
    if (this.serverForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isCreating = true;

    try {
      const serverData: Server = {
        name: this.serverForm.get('name')?.value,
        municipality_code: this.data.municipalityCode,
        municipality_name: this.data.municipalityName
      };

      // Integrar com API para criar servidor
      const createdServer = await this.createServerAPI(serverData);

      this.snackBar.open(`Servidor ${createdServer.name} criado com sucesso!`, 'Fechar', {
        duration: 3000,
        panelClass: ['snackbar-success']
      });
      // Emitir o servidor retornado pela API (contendo ID e demais campos)
      this.serverCreated.emit(createdServer);

    } catch (error: any) {
      this.snackBar.open(`Erro ao criar servidor: ${error.message}`, 'Fechar', {
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
    Object.keys(this.serverForm.controls).forEach(key => {
      this.serverForm.get(key)?.markAsTouched();
    });
  }

  private async createServerAPI(server: Server): Promise<any> {
    return new Promise((resolve, reject) => {
      this.documentsService.createServer(server).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            resolve(response.data);
          } else {
            reject(new Error(response.message || 'Erro ao criar servidor'));
          }
        },
        error: (error) => {
          console.error('Erro na API de servidor:', error);
          reject(new Error('Erro ao criar servidor. Tente novamente.'));
        }
      });
    });
  }
}
