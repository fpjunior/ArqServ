import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { DocumentsService, Municipality, Document, UploadProgress } from '../../services/documents.service';

// Dialogs
import { MunicipalityDialogComponent } from '../../dialogs/municipality-dialog/municipality-dialog.component';
import { ServerDialogComponent } from '../../dialogs/server-dialog/server-dialog.component';

// Angular Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';

// Interfaces adicionais
interface Server {
  id: number;
  name: string;
  municipality_code: string;
  drive_folder_id?: string;
  created_at: string;
}

@Component({
  selector: 'app-upload-documents',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MunicipalityDialogComponent,
    ServerDialogComponent
  ],
  templateUrl: './upload-documents.component.html',
  styleUrl: './upload-documents.component.scss'
})
export class UploadDocumentsComponent implements OnInit {
  uploadForm!: FormGroup;
  selectedFile: File | null = null;
  isDragOver = false;
  isUploading = false;
  uploadProgress = 0;
  message = '';

  municipalities: Municipality[] = [
    { code: '3550308', name: 'São Paulo', state: 'SP' },
    { code: '3304557', name: 'Rio de Janeiro', state: 'RJ' },
    { code: '3106200', name: 'Belo Horizonte', state: 'MG' },
    { code: '4106902', name: 'Curitiba', state: 'PR' },
    { code: '5300108', name: 'Brasília', state: 'DF' }
  ];

  servers: Server[] = [];
  recentDocuments: Document[] = [];
  selectedMunicipalityCode: string = '';
  selectedMunicipalityName: string = '';
  
  // Controle do diálogo customizado
  showTailwindDialog = false;
  showServerDialog = false;

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private documentsService: DocumentsService
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    this.loadRecentDocuments();
  }

  private createForm(): void {
    this.uploadForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      municipality_code: ['', Validators.required],
      server_id: ['', Validators.required]
    });
  }

  // Drag & Drop Events
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFileSelection(files[0]);
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.handleFileSelection(file);
    }
  }

  private handleFileSelection(file: File): void {
    // Validar tamanho (50MB)
    if (file.size > 50 * 1024 * 1024) {
      this.showMessage('Arquivo muito grande! Máximo 50MB.', 'error');
      return;
    }

    // Validar tipo
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      this.showMessage('Tipo de arquivo não permitido!', 'error');
      return;
    }

    this.selectedFile = file;
    
    // Auto-preencher título se estiver vazio
    if (!this.uploadForm.get('title')?.value) {
      const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
      this.uploadForm.patchValue({ title: nameWithoutExtension });
    }

    this.showMessage('Arquivo selecionado com sucesso!', 'success');
  }

  removeFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile = null;
    this.uploadProgress = 0;
  }

  async onSubmit(): Promise<void> {
    if (this.uploadForm.invalid || !this.selectedFile) {
      this.showMessage('Preencha todos os campos obrigatórios!', 'error');
      return;
    }

    this.isUploading = true;
    this.uploadProgress = 0;

    try {
      const selectedMunicipality = this.municipalities.find(m => m.code === this.uploadForm.get('municipality_code')?.value);
      const selectedServer = this.servers.find(s => s.id === this.uploadForm.get('server_id')?.value);

      const documentData = {
        title: this.uploadForm.get('title')?.value,
        description: this.uploadForm.get('description')?.value || '',
        municipality_code: this.uploadForm.get('municipality_code')?.value,
        server_id: this.uploadForm.get('server_id')?.value,
        server_name: selectedServer?.name || '',
        municipality_name: selectedMunicipality?.name || ''
      };

      // Subscrever ao progresso de upload
      this.documentsService.uploadProgress$.subscribe(progress => {
        if (progress) {
          this.uploadProgress = progress.percentage;
        }
      });

      // Fazer upload real para API
      this.documentsService.uploadDocument(this.selectedFile, documentData)
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.uploadProgress = 100;
              this.showMessage('Documento enviado com sucesso!', 'success');
              this.resetForm();
              this.loadRecentDocuments();
            } else {
              throw new Error(response.message || 'Erro no upload');
            }
          },
          error: (error) => {
            this.showMessage(`Erro no upload: ${error.message}`, 'error');
            this.uploadProgress = 0;
          },
          complete: () => {
            this.isUploading = false;
            this.documentsService.resetUploadProgress();
          }
        });

    } catch (error: any) {
      this.showMessage(`Erro no upload: ${error.message}`, 'error');
      this.uploadProgress = 0;
      this.isUploading = false;
    }
  }

  // Carregar servidores quando município for selecionado
  onMunicipalityChange(event: any): void {
    const municipalityCode = event.value;
    this.selectedMunicipalityCode = municipalityCode;
    
    // Definir nome do município
    const municipality = this.municipalities.find(m => m.code === municipalityCode);
    this.selectedMunicipalityName = municipality ? municipality.name : '';
    
    this.loadServersByMunicipality(municipalityCode);
    
    // Resetar seleção de servidor
    this.uploadForm.get('server_id')?.setValue('');
  }

  // Carregar servidores do município
  async loadServersByMunicipality(municipalityCode: string): Promise<void> {
    try {
      console.log(`🔄 Carregando servidores para município: ${municipalityCode}`);
      
      this.documentsService.getServersByMunicipality(municipalityCode).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Se retornou dados agrupados por letra, pegar os servidores
            if (typeof response.data === 'object' && 'servers' in response.data && Array.isArray(response.data.servers)) {
              this.servers = response.data.servers;
            } else if (Array.isArray(response.data)) {
              this.servers = response.data;
            } else {
              this.servers = [];
            }
            
            console.log(`✅ ${this.servers.length} servidores carregados para ${municipalityCode}`);
          } else {
            this.servers = [];
            console.warn('Resposta sem sucesso:', response);
          }
        },
        error: (error) => {
          console.error('❌ Erro ao carregar servidores:', error);
          this.servers = [];
          this.showMessage('Erro ao carregar servidores. Tente novamente.', 'error');
        }
      });
    } catch (error) {
      console.error('Erro ao carregar servidores:', error);
      this.servers = [];
      this.showMessage('Erro ao carregar servidores.', 'error');
    }
  }

  openServerDialog(): void {
    console.log('🔄 Abrindo diálogo de servidor...');
    
    if (!this.selectedMunicipalityCode) {
      this.showMessage('Selecione um município primeiro!', 'error');
      return;
    }

    // Usar modal customizado em vez do Angular Material
    this.showServerDialog = true;
  }

  resetForm(): void {
    this.uploadForm.reset();
    this.selectedFile = null;
    this.uploadProgress = 0;
    this.isDragOver = false;
  }

  // Método de teste para verificar se os cliques funcionam
  testClick(type: string): void {
    console.log(`🎯 Botão ${type} clicado!`);
    alert(`Botão ${type} funcionou!`);
    
    if (type === 'municipality') {
      this.openMunicipalityDialog();
    } else if (type === 'server') {
      this.openServerDialog();
    }
  }

  openMunicipalityDialog(): void {
    console.log('🔄 Abrindo diálogo customizado Tailwind...');
    console.log('📋 showTailwindDialog antes:', this.showTailwindDialog);
    this.showTailwindDialog = true;
    console.log('📋 showTailwindDialog depois:', this.showTailwindDialog);
  }

  onMunicipalityCreated(municipality: any): void {
    console.log('📋 Município criado:', municipality);
    
    // Adicionar novo município à lista
    const newMunicipality = {
      id: Date.now(), // ID temporário
      code: municipality.code,
      name: municipality.name,
      state: municipality.state
    } as Municipality;
    
    this.municipalities.push(newMunicipality);
    
    // Selecionar o município recém-criado
    this.uploadForm.patchValue({
      municipality_code: municipality.code
    });

    // Carregar servidores do município
    this.onMunicipalityChange({ value: municipality.code });
    
    // Fechar diálogo
    this.showTailwindDialog = false;
    
    this.showMessage(`Município ${municipality.name} adicionado com sucesso!`, 'success');
  }

  onMunicipalityDialogCancelled(): void {
    console.log('📋 Diálogo de município cancelado');
    this.showTailwindDialog = false;
  }

  testCreateMunicipality(): void {
    console.log('📋 Teste de criação de município');
    const testMunicipality = {
      code: '1234567',
      name: 'Município Teste',
      state: 'SP'
    };
    this.onMunicipalityCreated(testMunicipality);
  }

  // Métodos do modal do servidor
  onServerDialogCancelled(): void {
    console.log('📋 Diálogo de servidor cancelado');
    this.showServerDialog = false;
  }

  testCreateServer(): void {
    console.log('📋 Teste de criação de servidor');
    if (!this.selectedMunicipalityCode) {
      this.showMessage('Selecione um município primeiro!', 'error');
      return;
    }
    
    const testServer = {
      id: Date.now(), // ID temporário
      name: 'Servidor Teste',
      description: 'Servidor criado para teste',
      municipality_code: this.selectedMunicipalityCode
    };
    
    this.onServerCreated(testServer);
  }

  onServerCreated(server: any): void {
    console.log('📋 Servidor criado:', server);
    
    // Adicionar novo servidor à lista
    this.servers.push(server);
    
    // Selecionar o servidor recém-criado
    this.uploadForm.patchValue({
      server_id: server.id
    });
    
    // Fechar modal
    this.showServerDialog = false;
    
    this.showMessage(`Servidor ${server.name} adicionado com sucesso!`, 'success');
  }

  getMunicipalityName(): string {
    const municipality = this.municipalities.find(m => m.code === this.selectedMunicipalityCode);
    return municipality ? municipality.name : '';
  }

  // Utility Methods
  getFileIcon(mimeType: string): string {
    if (mimeType.includes('pdf')) return 'picture_as_pdf';
    if (mimeType.includes('image')) return 'image';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'description';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'table_chart';
    if (mimeType.includes('text')) return 'article';
    return 'insert_drive_file';
  }

  getFileIconColor(mimeType: string): string {
    if (mimeType.includes('pdf')) return 'warn';
    if (mimeType.includes('image')) return 'accent';
    if (mimeType.includes('word')) return 'primary';
    if (mimeType.includes('excel')) return 'accent';
    return 'primary';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.snackBar.open(message, 'Fechar', {
      duration: type === 'error' ? 5000 : 3000,
      panelClass: [`snackbar-${type}`],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  // Document Management Methods
  private loadRecentDocuments(): void {
    // TODO: Carregar documentos da API
    this.recentDocuments = []; // Por enquanto vazio
  }

  viewDocument(doc: Document): void {
    // TODO: Implementar visualização de documento
    this.showMessage('Abrindo documento...', 'info');
  }

  downloadDocument(doc: Document, event: Event): void {
    event.stopPropagation();
    // TODO: Implementar download
    this.showMessage('Baixando documento...', 'info');
  }

  deleteDocument(doc: Document, event: Event): void {
    event.stopPropagation();
    // TODO: Implementar confirmação e delete
    this.showMessage('Documento excluído!', 'success');
  }
}
