import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DocumentsService } from '../../../../services/documents.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { DomSanitizer } from '@angular/platform-browser';
import { AuthService } from '../../../../shared/services/auth.service';
import { ConfirmDeleteModalComponent } from '../../../../shared/components/confirm-delete-modal/confirm-delete-modal.component';
import { SuccessModalComponent } from '../../../../shared/components/success-modal/success-modal.component';

interface FinancialDocument {
  id: number;
  name: string;
  type: string;
  uploadDate: Date;
  size: string;
  status: 'active' | 'archived' | 'pending';
  description?: string;
  tags?: string[];
  googleDriveId?: string;
  googleDriveUrl?: string;
  file_type?: string;
  mime_type?: string;
}

interface FinancialCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

@Component({
  selector: 'app-financial-category-details',
  standalone: true,
  imports: [CommonModule, ConfirmDeleteModalComponent, SuccessModalComponent],
  templateUrl: './financial-category-details.component.html',
  styleUrls: ['./financial-category-details.component.scss']
})
export class FinancialCategoryDetailsComponent implements OnInit {
  categoryId: string = '';
  municipalityCode: string = '';
  category: FinancialCategory | null = null;
  documents: FinancialDocument[] = [];
  filteredDocuments: FinancialDocument[] = [];
  searchTerm: string = '';
  selectedStatus: string = 'all';
  isLoading: boolean = true;
  isModalVisible: boolean = false;
  selectedDocumentId: string = '';
  modalIsLoading: boolean = false;
  modalViewerUrl: any;
  storageUsed: number = 0;
  storageTotal: number = 0;
  confirmDeleteModalVisible = false;
  documentToDelete: FinancialDocument | null = null;
  errorMessage: string = '';
  successModalVisible: boolean = false;
  successMessage: string = '';
  year: number | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private documentsService: DocumentsService,
    private sanitizer: DomSanitizer,
    private authService: AuthService // Adicionado para corrigir o erro
  ) { }

  // Definição das categorias
  categories: { [key: string]: FinancialCategory } = {
    'balanco': {
      id: 'balanco',
      name: 'Balanço Patrimonial',
      icon: '⚖️',
      description: 'Documentos de balanço patrimonial',
      color: 'from-indigo-500 to-indigo-600'
    },
    'orcamento': {
      id: 'orcamento',
      name: 'Orçamento Anual',
      icon: '📊',
      description: 'Documentos de orçamento anual',
      color: 'from-cyan-500 to-cyan-600'
    },
    'prestacao-contas': {
      id: 'prestacao-contas',
      name: 'Prestação de Contas',
      icon: '🔍',
      description: 'Documentos de prestação de contas',
      color: 'from-orange-500 to-orange-600'
    },
    'receitas': {
      id: 'receitas',
      name: 'Relatório de Receitas',
      icon: '📈',
      description: 'Documentos de receitas e arrecadação',
      color: 'from-green-500 to-green-600'
    },
    'despesas': {
      id: 'despesas',
      name: 'Relatório de Despesas',
      icon: '📉',
      description: 'Relatórios de despesas',
      color: 'from-red-500 to-red-600'
    },
    'licitacoes': {
      id: 'licitacoes',
      name: 'Licitações e Contratos',
      icon: '📋',
      description: 'Documentos de processos licitatórios e contratos',
      color: 'from-blue-500 to-blue-600'
    },
    'folha-pagamento': {
      id: 'folha-pagamento',
      name: 'Folha de Pagamento',
      icon: '💰',
      description: 'Documentos de folha de pagamento',
      color: 'from-purple-500 to-purple-600'
    },
    'outros': {
      id: 'outros',
      name: 'Outros',
      icon: '📎',
      description: 'Outros documentos financeiros',
      color: 'from-gray-500 to-gray-600'
    }
  };

  // Documentos mockados para demonstração
  mockDocuments: FinancialDocument[] = [
    {
      id: 1,
      name: 'Edital de Licitação 001/2024',
      type: 'PDF',
      uploadDate: new Date('2024-11-15'),
      size: '2.3 MB',
      status: 'active',
      description: 'Edital para contratação de serviços de limpeza',
      tags: ['edital', 'limpeza', '2024'],
      googleDriveUrl: 'https://drive.google.com/file/d/example1'
    },
    {
      id: 2,
      name: 'Ata de Registro de Preços 002/2024',
      type: 'PDF',
      uploadDate: new Date('2024-11-10'),
      size: '1.8 MB',
      status: 'active',
      description: 'Ata de registro de preços para materiais de escritório',
      tags: ['ata', 'precos', 'materiais'],
      googleDriveUrl: 'https://drive.google.com/file/d/example2'
    },
    {
      id: 3,
      name: 'Folha de Pagamento - Outubro/2024',
      type: 'XLSX',
      uploadDate: new Date('2024-11-01'),
      size: '856 KB',
      status: 'active',
      description: 'Folha de pagamento dos servidores - outubro',
      tags: ['folha', 'pagamento', 'outubro'],
      googleDriveUrl: 'https://drive.google.com/file/d/example3'
    },
    {
      id: 4,
      name: 'Relatório de Receitas - 3º Trimestre',
      type: 'PDF',
      uploadDate: new Date('2024-10-30'),
      size: '3.2 MB',
      status: 'active',
      description: 'Relatório consolidado de receitas do terceiro trimestre',
      tags: ['receitas', 'trimestre', 'relatorio'],
      googleDriveUrl: 'https://drive.google.com/file/d/example4'
    },
    {
      id: 5,
      name: 'Contrato de Prestação de Serviços 15/2024',
      type: 'PDF',
      uploadDate: new Date('2024-10-25'),
      size: '1.2 MB',
      status: 'pending',
      description: 'Contrato para serviços de manutenção predial',
      tags: ['contrato', 'manutencao', 'predial'],
      googleDriveUrl: 'https://drive.google.com/file/d/example5'
    }
  ];

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.categoryId = params['category'];
      this.municipalityCode = params['municipalityCode'] || sessionStorage.getItem('selectedMunicipalityCode') || '';
      this.year = params['year'] ? parseInt(params['year'], 10) : null;
      console.log('🎯 [FINANCIAL-CATEGORY] Category:', this.categoryId, 'Municipality:', this.municipalityCode, 'Year:', this.year);

      if (!this.municipalityCode) {
        console.error('❌ [FINANCIAL-CATEGORY] Código do município não encontrado');
        const storedCode = sessionStorage.getItem('selectedMunicipalityCode');
        if (storedCode) {
          this.router.navigate(['/documentacoes-financeiras/municipality', storedCode]);
        } else {
          this.router.navigate(['/documentacoes-financeiras']);
        }
        return;
      }

      this.loadCategoryData();
    });

    this.fetchStorageInfo();
  }

  loadCategoryData(): void {
    this.isLoading = true;

    // Carregar dados da categoria
    this.category = this.categories[this.categoryId];

    if (!this.category) {
      const storedCode = sessionStorage.getItem('selectedMunicipalityCode');
      if (storedCode) {
        this.router.navigate(['/documentacoes-financeiras/municipality', storedCode]);
      } else {
        this.router.navigate(['/documentacoes-financeiras']);
      }
      return;
    }

    // Buscar documentos reais da API
    // Buscar documentos reais da API
    let url = `${environment.apiUrl}/documents/financial/${this.municipalityCode}/type/${this.categoryId}`;
    if (this.year) {
      url += `?year=${this.year}`;
    }
    console.log('📡 [FINANCIAL-CATEGORY] Buscando documentos de:', url);

    this.http.get<any>(url).subscribe(
      (response) => {
        console.log('✅ [FINANCIAL-CATEGORY] Documentos recebidos:', response);
        if (response && response.success && response.data) {
          this.documents = response.data.map((doc: any) => ({
            id: doc.id,
            name: doc.title || doc.file_name,
            type: doc.file_type || 'PDF',
            uploadDate: new Date(doc.created_at),
            size: doc.file_size || 'N/A',
            status: doc.is_active ? 'active' : 'archived',
            description: doc.description,
            googleDriveId: doc.google_drive_id,
            googleDriveUrl: doc.google_drive_url,
            file_type: doc.file_type,
            mime_type: doc.mime_type || this.getMimeTypeFromFileName(doc.file_name)
          })).sort((a: any, b: any) => {
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
          });
          this.filteredDocuments = [...this.documents];
        }
        this.isLoading = false;
      },
      (error) => {
        console.error('❌ [FINANCIAL-CATEGORY] Erro ao buscar documentos:', error);
        this.documents = [];
        this.filteredDocuments = [];
        this.isLoading = false;
      }
    );
  }

  private fetchStorageInfo(): void {
    console.log('🚀 fetchStorageInfo iniciado');
    this.documentsService.getDriveStorageInfo().subscribe({
      next: (response) => {
        console.log('✅ Resposta recebida:', response);
        if (response.success && response.data) {
          console.log('📦 Dados encontrados:', response.data);
          this.storageUsed = response.data.used;
          this.storageTotal = response.data.total;
          console.log('💾 Valores atribuídos - Usado:', this.storageUsed, 'Total:', this.storageTotal);
        } else {
          console.warn('⚠️ Resposta sem sucesso ou sem dados:', response);
        }
      },
      error: (err) => {
        console.error('❌ Erro ao carregar informações de armazenamento:', err);
      },
    });
  }

  private getDocumentCategory(documentName: string): string {
    const name = documentName.toLowerCase();
    if (name.includes('edital') || name.includes('licitação') || name.includes('ata')) {
      return 'licitacoes';
    } else if (name.includes('folha') || name.includes('pagamento') || name.includes('despesa')) {
      return 'despesas';
    } else if (name.includes('receita') || name.includes('arrecadação')) {
      return 'receitas';
    } else if (name.includes('contrato')) {
      return 'contratos';
    }
    return this.categoryId; // fallback para a categoria atual
  }

  filterDocuments(): void {
    this.filteredDocuments = this.documents.filter(doc => {
      const matchesSearch = !this.searchTerm ||
        doc.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        doc.description?.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesStatus = this.selectedStatus === 'all' || doc.status === this.selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }

  onSearchChange(event: any): void {
    this.searchTerm = event.target.value;
    this.filterDocuments();
  }

  onStatusChange(event: any): void {
    this.selectedStatus = event.target.value;
    this.filterDocuments();
  }

  downloadDocument(doc: FinancialDocument): void {
    console.log(`⬇️ Iniciando download de: ${doc.name}`);

    const googleDriveId = doc.googleDriveId;
    if (!googleDriveId) {
      alert('ID do Google Drive não encontrado para download');
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      alert('Token de autenticação não encontrado');
      return;
    }

    // Usar endpoint de download específico para Google Drive
    this.http.get(`${environment.apiUrl}/documents/drive/${googleDriveId}/download`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      responseType: 'blob',
      observe: 'response'
    }).subscribe({
      next: (response) => {
        console.log('✅ Download concluído');

        // Criar URL para o blob e fazer download
        const blob = response.body;
        if (blob) {
          const url = window.URL.createObjectURL(blob);
          const link = window.document.createElement('a'); // Corrigido para usar o objeto global document
          link.href = url;
          link.download = doc.name;
          window.document.body.appendChild(link);
          link.click();
          window.document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }
      },
      error: (error) => {
        console.error('❌ Erro no download:', error);
        alert('Erro ao fazer download do arquivo');
      }
    });
  }

  viewDocument(document: FinancialDocument): void {
    console.log('🆕 Visualizando documento:', document);

    const googleDriveId = document.googleDriveId;
    if (!googleDriveId) {
      console.error('❌ ID do Google Drive não encontrado para este documento:', document);
      console.log('📋 Propriedades do documento:', {
        id: document.id,
        name: document.name,
        googleDriveId: document.googleDriveId,
        googleDriveUrl: document.googleDriveUrl
      });
      alert('ID do Google Drive não encontrado para este documento. Verifique se o documento foi salvo com ID válido.');
      return;
    }

    // FORÇAR modal a aparecer imediatamente
    this.isModalVisible = true;
    this.selectedDocumentId = googleDriveId;
    this.modalIsLoading = true;

    console.log('🔥 FORÇANDO modal visibility:', this.isModalVisible);
    console.log('🔥 Google Drive ID:', this.selectedDocumentId);

    // Criar URL segura
    const embedUrl = `https://drive.google.com/file/d/${googleDriveId}/preview`;
    this.modalViewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    console.log('🔥 Modal URL criada:', embedUrl);

    // Registrar visualização
    this.documentsService.logView({
      documentId: document.id,
      driveFileId: googleDriveId,
      fileName: document.name,
      municipalityCode: this.municipalityCode
    }).subscribe();

    // Adicionar verificação para garantir que o modal está sendo exibido
    if (!this.isModalVisible || !this.modalViewerUrl) {
      console.error('❌ O modal não foi configurado corretamente. Verifique as propriedades.');
      alert('Erro ao configurar o modal de visualização.');
      return;
    }

    // Parar loading após 1s
    setTimeout(() => {
      this.modalIsLoading = false;
      console.log('🔥 Modal loading finished');
    }, 1000);

    // JAMAIS abrir nova guia
    return; // Garante que nada mais seja executado
  }

  showDeleteModal(document: FinancialDocument): void {
    this.documentToDelete = document;
    this.confirmDeleteModalVisible = true;
  }

  onDeleteConfirmed(): void {
    if (!this.documentToDelete) return;
    this.isLoading = true;
    this.documentsService.deleteFinancialDocument(this.documentToDelete.id).subscribe({
      next: () => {
        // Remove do array local
        this.documents = this.documents.filter(d => d.id !== this.documentToDelete!.id);
        this.filteredDocuments = this.filteredDocuments.filter(d => d.id !== this.documentToDelete!.id);
        this.confirmDeleteModalVisible = false;
        this.documentToDelete = null;

        // Exibir modal de sucesso
        this.successMessage = 'Documento removido com sucesso!';
        this.successModalVisible = true;

        // Fechar modal automaticamente após 3 segundos
        setTimeout(() => {
          this.successModalVisible = false;
        }, 3000);
      },
      error: (error) => {
        console.error('Erro ao remover documento:', error);
        this.errorMessage = 'Erro ao remover documento financeiro.';
        this.confirmDeleteModalVisible = false;
        this.documentToDelete = null;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  onDeleteModalClosed(): void {
    this.confirmDeleteModalVisible = false;
    this.documentToDelete = null;
  }

  navigateBack(): void {
    const municipalityCode = this.municipalityCode || sessionStorage.getItem('selectedMunicipalityCode');
    if (municipalityCode && this.categoryId) {
      // Voltar para o seletor de anos
      this.router.navigate(['/documentacoes-financeiras/municipality', municipalityCode, this.categoryId]);
    } else if (municipalityCode) {
      this.router.navigate(['/documentacoes-financeiras/municipality', municipalityCode]);
    } else {
      this.router.navigate(['/documentacoes-financeiras']);
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'active':
        return 'Ativo';
      case 'pending':
        return 'Pendente';
      case 'archived':
        return 'Arquivado';
      default:
        return 'Desconhecido';
    }
  }

  getFileTypeIcon(type: string): string {
    switch (type.toUpperCase()) {
      case 'PDF':
        return '📄';
      case 'DOC':
      case 'DOCX':
        return '📝';
      case 'XLS':
      case 'XLSX':
        return '📊';
      case 'JPG':
      case 'JPEG':
      case 'PNG':
        return '🖼️';
      default:
        return '📎';
    }
  }

  getFileIcon(fileType: string): string {
    const type = fileType.toLowerCase();
    if (type.includes('pdf')) return '📄';
    if (type.includes('image')) return '🖼️';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('sheet')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📋';
    if (type.includes('text')) return '📄';
    return '📁';
  }

  getMimeTypeFromFileName(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'txt': 'text/plain'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  getFileExtension(mimeType: string): string {
    if (mimeType?.includes('pdf')) return 'PDF';
    if (mimeType?.includes('image/jpeg')) return 'JPG';
    if (mimeType?.includes('image/png')) return 'PNG';
    if (mimeType?.includes('image')) return 'IMG';
    if (mimeType?.includes('word') || mimeType?.includes('document')) return 'DOC';
    if (mimeType?.includes('excel') || mimeType?.includes('sheet')) return 'XLS';
    if (mimeType?.includes('powerpoint') || mimeType?.includes('presentation')) return 'PPT';
    if (mimeType?.includes('text')) return 'TXT';
    return 'FILE';
  }

  getDocumentsByStatus(status: string): number {
    return this.documents.filter(doc => doc.status === status).length;
  }

  closeModal(): void {
    console.log('❌ Fechando modal');
    this.isModalVisible = false;
    this.selectedDocumentId = '';
    this.modalViewerUrl = null;
    this.modalIsLoading = false;
  }
}