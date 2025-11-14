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
    { code: '2600500', name: 'Aliança', state: 'PE' },
    { code: '2600609', name: 'Amaraji', state: 'PE' },
    { code: '2600708', name: 'Araçoiaba', state: 'PE' },
    { code: '2604106', name: 'Condado', state: 'PE' },
    { code: '2611101', name: 'Palmares', state: 'PE' },
    { code: '2615607', name: 'Vertente', state: 'PE' },
    { code: '2607307', name: 'Ingazeira', state: 'PE' },
    { code: '2609907', name: 'Nabuco', state: 'PE' }
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
    const municipalityCode = event.target.value;
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
      
      // Filtrar servidores mockados por município
      const allServers: Server[] = [
        // Aliança (2600500)
        { id: 1, name: 'Ana Silva Santos', municipality_code: '2600500', created_at: '2024-01-01' },
        { id: 2, name: 'João Carlos Oliveira', municipality_code: '2600500', created_at: '2024-01-01' },
        { id: 3, name: 'Carlos Eduardo Ramos', municipality_code: '2600500', created_at: '2024-01-01' },
        
        // Amaraji (2600609)
        { id: 4, name: 'Maria Fernanda Lima', municipality_code: '2600609', created_at: '2024-01-01' },
        { id: 5, name: 'Pedro Henrique Costa', municipality_code: '2600609', created_at: '2024-01-01' },
        { id: 6, name: 'Beatriz Almeida Souza', municipality_code: '2600609', created_at: '2024-01-01' },
        
        // Araçoiaba (2600708)
        { id: 7, name: 'Juliana Pereira Souza', municipality_code: '2600708', created_at: '2024-01-01' },
        { id: 8, name: 'Fernando Dias Machado', municipality_code: '2600708', created_at: '2024-01-01' },
        { id: 9, name: 'Camila Rodrigues Lopes', municipality_code: '2600708', created_at: '2024-01-01' },
        
        // Condado (2604106)
        { id: 10, name: 'Roberto da Silva Junior', municipality_code: '2604106', created_at: '2024-01-01' },
        { id: 11, name: 'Carla Mendes Alves', municipality_code: '2604106', created_at: '2024-01-01' },
        { id: 12, name: 'Miguel Santos Barbosa', municipality_code: '2604106', created_at: '2024-01-01' },
        
        // Palmares (2611101)
        { id: 13, name: 'Lucas Ferreira Rocha', municipality_code: '2611101', created_at: '2024-01-01' },
        { id: 14, name: 'Gabriela Nascimento Silva', municipality_code: '2611101', created_at: '2024-01-01' },
        { id: 15, name: 'André Luiz Cardoso', municipality_code: '2611101', created_at: '2024-01-01' },
        
        // Vertente (2615607)
        { id: 16, name: 'Patrícia Ribeiro Campos', municipality_code: '2615607', created_at: '2024-01-01' },
        { id: 17, name: 'Rodrigo Menezes Filho', municipality_code: '2615607', created_at: '2024-01-01' },
        { id: 18, name: 'Larissa Cavalcanti Cruz', municipality_code: '2615607', created_at: '2024-01-01' },
        
        // Ingazeira (2607307)
        { id: 19, name: 'Rafael Gonçalves Nunes', municipality_code: '2607307', created_at: '2024-01-01' },
        { id: 20, name: 'Isabela Freitas Moreno', municipality_code: '2607307', created_at: '2024-01-01' },
        { id: 21, name: 'Daniel Augusto Pereira', municipality_code: '2607307', created_at: '2024-01-01' },
        
        // Nabuco (2609907)
        { id: 22, name: 'Amanda Torres Barbosa', municipality_code: '2609907', created_at: '2024-01-01' },
        { id: 23, name: 'Thiago Martins Araújo', municipality_code: '2609907', created_at: '2024-01-01' },
        { id: 24, name: 'Mariana Correia Batista', municipality_code: '2609907', created_at: '2024-01-01' }
      ];
      
      this.servers = allServers.filter(server => server.municipality_code === municipalityCode);
      console.log(`✅ ${this.servers.length} servidores carregados para ${municipalityCode}`);
      
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
    this.onMunicipalityChange({ target: { value: municipality.code } });
    
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
