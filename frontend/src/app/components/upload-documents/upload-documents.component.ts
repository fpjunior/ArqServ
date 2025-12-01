import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
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
    FormsModule,
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
  
  // Controle do tipo de upload
  uploadType: 'servidores' | 'financeiras' = 'servidores';
  
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
    console.log('🔄 Upload component initialized');
    console.log('📋 Component state:', {
      uploadForm: this.uploadForm,
      fb: this.fb,
      snackBar: this.snackBar,
      documentsService: this.documentsService
    });
    
    // Teste imediato ao carregar
    setTimeout(() => {
      console.log('⏰ Teste após 2 segundos - componente ainda ativo');
    }, 2000);
    
    this.loadMunicipalities();
    this.loadRecentDocuments();
    this.setupFormValidation();
  }

  private setupFormValidation(): void {
    // Método para atualizar validações quando o tipo de upload mudar
    // Por enquanto não é necessário, pois as validações são verificadas dinamicamente
  }

  // Método para carregar municípios
  private loadMunicipalities(): void {
    console.log('📍 Loading municipalities...');
    this.documentsService.getMunicipalities().subscribe({
      next: (response) => {
        if (response.success) {
          this.municipalities = response.data || [];
          console.log(`✅ ${this.municipalities.length} municípios carregados`);
        } else {
          console.error('❌ Erro ao carregar municípios:', response.message);
          this.showMessage('Erro ao carregar municípios', 'error');
        }
      },
      error: (error) => {
        console.error('❌ Erro na requisição de municípios:', error);
        this.showMessage('Erro ao carregar municípios', 'error');
      }
    });
  }

  private createForm(): void {
    this.uploadForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      municipality_code: ['', Validators.required],
      server_id: [''], // Não obrigatório para documentos financeiros
      // Novos campos para documentos financeiros
      financial_document_type: [''],
      financial_year: [''],
      financial_period: ['']
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

      if (!selectedMunicipality) {
        this.showMessage('Município selecionado não encontrado!', 'error');
        this.isUploading = false;
        return;
      }

      if (!selectedServer) {
        this.showMessage('Servidor selecionado não encontrado!', 'error');
        this.isUploading = false;
        return;
      }

      // Preparar dados do documento com estrutura hierárquica completa
      const documentData = {
        title: this.uploadForm.get('title')?.value,
        description: this.uploadForm.get('description')?.value || '',
        category: 'documento', // Categoria padrão
        municipality_code: this.uploadForm.get('municipality_code')?.value,
        server_id: this.uploadForm.get('server_id')?.value,
        server_name: selectedServer.name,
        municipality_name: selectedMunicipality.name
      };

      console.log('📤 Iniciando upload com estrutura hierárquica:', {
        municipality: selectedMunicipality.name,
        server: selectedServer.name,
        letterGroup: `Servidores ${selectedServer.name.charAt(0).toUpperCase()}`,
        fileName: this.selectedFile.name
      });

      // Subscrever ao progresso de upload
      this.documentsService.uploadProgress$.subscribe(progress => {
        if (progress) {
          this.uploadProgress = progress.percentage;
        }
      });

      // Fazer upload real para API - arquivo será organizado na estrutura:
      // Root > Municipality > Servidores [Letter] > Server Name > arquivo
      console.log('🚀 ========= CHAMANDO API DE UPLOAD =========');
      console.log('📤 Dados que serão enviados:', {
        file: {
          name: this.selectedFile.name,
          size: this.selectedFile.size,
          type: this.selectedFile.type
        },
        data: documentData,
        serviceExists: !!this.documentsService
      });
      
      console.log('📡 Executando documentsService.uploadDocument...');
      this.documentsService.uploadDocument(this.selectedFile, documentData)
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.uploadProgress = 100;
              this.showMessage(
                `Documento enviado com sucesso para: ${selectedMunicipality.name} > Servidores ${selectedServer.name.charAt(0).toUpperCase()} > ${selectedServer.name}`, 
                'success'
              );
              this.resetForm();
              this.loadRecentDocuments();
            } else {
              throw new Error(response.message || 'Erro no upload');
            }
          },
          error: (error: any) => {
            console.error('❌ Erro no upload:', error);
            this.showMessage(`Erro no upload: ${error?.message || 'Erro desconhecido'}`, 'error');
            this.uploadProgress = 0;
          },
          complete: () => {
            this.isUploading = false;
            this.documentsService.resetUploadProgress();
          }
        });

    } catch (error: any) {
      console.error('❌ Erro geral no upload:', error);
      this.showMessage(`Erro no upload: ${error?.message || 'Erro desconhecido'}`, 'error');
      this.uploadProgress = 0;
      this.isUploading = false;
    }
  }

  // Método para carregar servidores quando município for selecionado
  onMunicipalityChange(event: any): void {
    const municipalityCode = event.target.value;
    this.selectedMunicipalityCode = municipalityCode;
    
    // Definir nome do município
    const municipality = this.municipalities.find(m => m.code === municipalityCode);
    this.selectedMunicipalityName = municipality ? municipality.name : '';
    
    console.log(`📍 [MUNICIPALITY CHANGE] Código: ${municipalityCode}, Nome: ${this.selectedMunicipalityName}`);
    
    // Limpar lista de servidores primeiro
    this.servers = [];
    
    if (municipalityCode) {
      this.loadServersByMunicipality(municipalityCode);
    }
    
    // Resetar seleção de servidor
    this.uploadForm.get('server_id')?.setValue('');
  }

  // Carregar servidores do município
  async loadServersByMunicipality(municipalityCode: string): Promise<void> {
    try {
      console.log(`🔄 [LOAD SERVERS] Iniciando busca para município: ${municipalityCode}`);
      console.log(`🌐 [API URL] ${this.documentsService['apiUrl']}/servers/municipality/${municipalityCode}`);

      this.documentsService.getServersByMunicipality(municipalityCode).subscribe({
        next: (response: any) => {
          console.log(`📦 [RESPONSE] Resposta completa:`, response);
          
          if (!response || !response.success) {
            console.warn('⚠️ [RESPONSE] Resposta inesperada da API:', response);
            this.servers = [];
            return;
          }

          // Endpoint pode retornar { servers, groupedByLetter } ou array simples
          const data = response.data;
          console.log(`📋 [DATA] Data recebida:`, data);
          
          const servers = data?.servers || data || [];
          this.servers = servers || [];
          
          console.log(`✅ [SUCCESS] ${this.servers.length} servidores carregados:`, this.servers);
          
          if (this.servers.length === 0) {
            this.showMessage(`Nenhum servidor encontrado para ${this.selectedMunicipalityName}`, 'info');
          }
        },
        error: (error: any) => {
          console.error('❌ [ERROR] Erro completo:', error);
          console.error('❌ [ERROR] Status:', error.status);
          console.error('❌ [ERROR] Message:', error.message);
          console.error('❌ [ERROR] Error object:', error.error);
          this.servers = [];
          this.showMessage('Erro ao carregar servidores.', 'error');
        }
      });
      
    } catch (error) {
      console.error('💥 [EXCEPTION] Erro geral:', error);
      this.servers = [];
      this.showMessage('Erro ao carregar servidores.', 'error');
    }
  }

  openServerDialog(): void {
    console.log('🔄 Abrindo diálogo de servidor...');
    console.log('📍 Municipality Code:', this.selectedMunicipalityCode);
    console.log('📍 Municipality Name:', this.selectedMunicipalityName);
    console.log('📍 showServerDialog antes:', this.showServerDialog);
    
    if (!this.selectedMunicipalityCode) {
      this.showMessage('Selecione um município primeiro!', 'error');
      return;
    }

    // Usar modal customizado em vez do Angular Material
    this.showServerDialog = true;
    console.log('📍 showServerDialog depois:', this.showServerDialog);
  }

  resetForm(): void {
    this.uploadForm.reset();
    this.selectedFile = null;
    this.uploadProgress = 0;
    this.isDragOver = false;
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


  // Métodos do modal do servidor
  onServerDialogCancelled(): void {
    console.log('📋 Diálogo de servidor cancelado');
    this.showServerDialog = false;
  }

  // Note: removed test methods for municipality and server creation to clean UI

  onServerCreated(server: any): void {
    console.log('📋 Servidor criado:', server);

    // Se servidor não tiver id, tentar recarregar lista do backend
    if (!server?.id) {
      this.showMessage('Servidor criado sem ID recebido, atualizando lista...', 'info');
      if (this.selectedMunicipalityCode) {
        this.loadServersByMunicipality(this.selectedMunicipalityCode);
      }
    } else {
      // Adicionar novo servidor à lista local
      const exists = this.servers.some(s => s.id === server.id);
      if (!exists) {
        this.servers.push(server);
      }

      // Selecionar o servidor recém-criado
      this.uploadForm.patchValue({
        server_id: `${server.id}`
      });
    }

    // Fechar modal
    this.showServerDialog = false;

    this.showMessage(`Servidor ${server.name} adicionado com sucesso!`, 'success');
  }

  getMunicipalityName(): string {
    const municipality = this.municipalities.find(m => m.code === this.selectedMunicipalityCode);
    return municipality ? municipality.name : '';
  }

  // Obter a estrutura hierárquica atual para mostrar ao usuário
  getHierarchicalPath(): string {
    const municipalityCode = this.uploadForm.get('municipality_code')?.value;
    const serverId = this.uploadForm.get('server_id')?.value;
    
    if (!municipalityCode || !serverId) {
      return 'Selecione município e servidor para ver o caminho...';
    }

    const municipality = this.municipalities.find(m => m.code === municipalityCode);
    const server = this.servers.find(s => s.id === parseInt(serverId));
    
    if (!municipality || !server) {
      return 'Dados incompletos...';
    }

    const letterGroup = `Servidores ${server.name.charAt(0).toUpperCase()}`;
    return `${municipality.name} > ${letterGroup} > ${server.name}`;
  }

  // Verificar se pode mostrar o caminho hierárquico
  
  // Método para debug do estado do botão
  isSubmitDisabled(): boolean {
    if (this.isUploading || !this.selectedFile) {
      return true;
    }

    const title = this.uploadForm.get('title')?.value;
    const municipality = this.uploadForm.get('municipality_code')?.value;

    // Campos básicos sempre obrigatórios
    if (!title || !municipality) {
      return true;
    }

    // Validação específica para cada tipo
    if (this.uploadType === 'servidores') {
      const serverId = this.uploadForm.get('server_id')?.value;
      return !serverId;
    } else if (this.uploadType === 'financeiras') {
      const documentType = this.uploadForm.get('financial_document_type')?.value;
      const year = this.uploadForm.get('financial_year')?.value;
      return !documentType || !year;
    }

    return false;
  }



  // Método do botão principal de upload
  mainButtonClick(event: any): void {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    
    if (this.isSubmitDisabled()) {
      this.showMessage('Preencha todos os campos obrigatórios e selecione um arquivo!', 'error');
      return;
    }
    
    if (!this.selectedFile) {
      this.showMessage('Selecione um arquivo primeiro!', 'error');
      return;
    }

    this.isUploading = true;
    this.uploadProgress = 0;

    const formData = {
      title: this.uploadForm.get('title')?.value || 'Documento Principal',
      municipality_code: this.uploadForm.get('municipality_code')?.value,
      server_id: this.uploadForm.get('server_id')?.value,
      description: this.uploadForm.get('description')?.value || ''
    };

    this.documentsService.uploadDocument(this.selectedFile, formData)
      .subscribe({
        next: (response) => {
          this.isUploading = false;
          this.showMessage('Upload realizado com sucesso!', 'success');
          this.loadRecentDocuments();
          this.clearForm();
        },
        error: (error: any) => {
          this.isUploading = false;
          this.showMessage('Erro no upload: ' + (error?.message || 'Erro desconhecido'), 'error');
        }
      });
  }


  canShowHierarchicalPath(): boolean {
    const municipalityCode = this.uploadForm.get('municipality_code')?.value;
    const serverId = this.uploadForm.get('server_id')?.value;
    return !!(municipalityCode && serverId);
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

  private clearForm(): void {
    console.log('🧹 Limpando formulário...');
    this.uploadForm.reset();
    this.selectedFile = null;
    this.uploadProgress = 0;
    this.isUploading = false;
    console.log('✅ Formulário limpo');
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

  // Métodos para Documentações Financeiras
  getAvailableYears(): number[] {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= currentYear - 10; year--) {
      years.push(year);
    }
    return years;
  }

  canShowFinancialPath(): boolean {
    const municipality = this.uploadForm.get('municipality_code')?.value;
    const documentType = this.uploadForm.get('financial_document_type')?.value;
    const year = this.uploadForm.get('financial_year')?.value;
    
    return this.uploadType === 'financeiras' && municipality && documentType && year;
  }

  getFinancialPath(): string {
    const municipality = this.municipalities.find(m => m.code === this.uploadForm.get('municipality_code')?.value);
    const documentType = this.uploadForm.get('financial_document_type')?.value;
    const year = this.uploadForm.get('financial_year')?.value;
    const period = this.uploadForm.get('financial_period')?.value;

    if (!municipality || !documentType || !year) {
      return '';
    }

    let path = `${municipality.name} > Documentações Financeiras > ${year}`;
    
    // Adicionar tipo de documento
    const typeNames: {[key: string]: string} = {
      'balanco': 'Balanço Patrimonial',
      'orcamento': 'Orçamento Anual',
      'prestacao-contas': 'Prestação de Contas',
      'receitas': 'Relatório de Receitas',
      'despesas': 'Relatório de Despesas',
      'licitacoes': 'Licitações e Contratos',
      'folha-pagamento': 'Folha de Pagamento',
      'outros': 'Outros'
    };
    
    path += ` > ${typeNames[documentType] || documentType}`;
    
    // Adicionar período se especificado
    if (period) {
      const periodNames: {[key: string]: string} = {
        '1': '1º Trimestre',
        '2': '2º Trimestre', 
        '3': '3º Trimestre',
        '4': '4º Trimestre',
        'semestral-1': '1º Semestre',
        'semestral-2': '2º Semestre'
      };
      
      path += ` > ${periodNames[period] || period}`;
    }

    return path;
  }
}
