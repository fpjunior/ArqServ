import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { DocumentsService } from '../../../../services/documents.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { DomSanitizer } from '@angular/platform-browser';

interface FinancialFolder {
  financial_document_type: string;
  count: number;
  name: string;
  icon: string;
  description: string;
  color: string;
}

// Mapeamento de ícones e cores para tipos de documentos
const FINANCIAL_TYPE_CONFIG: { [key: string]: { icon: string; color: string; description: string } } = {
  'balanco': { icon: '⚖️', color: 'from-indigo-500 to-indigo-600', description: 'Balanço Patrimonial' },
  'orcamento': { icon: '📊', color: 'from-cyan-500 to-cyan-600', description: 'Orçamento Anual' },
  'prestacao-contas': { icon: '🔍', color: 'from-orange-500 to-orange-600', description: 'Prestação de Contas' },
  'receitas': { icon: '📈', color: 'from-green-500 to-green-600', description: 'Relatório de Receitas' },
  'despesas': { icon: '📉', color: 'from-red-500 to-red-600', description: 'Relatório de Despesas' },
  'licitacoes': { icon: '📋', color: 'from-blue-500 to-blue-600', description: 'Licitações e Contratos' },
  'folha-pagamento': { icon: '💰', color: 'from-purple-500 to-purple-600', description: 'Folha de Pagamento' },
  'outros': { icon: '📎', color: 'from-gray-500 to-gray-600', description: 'Outros' }
};

// Mapeamento de nomes para exibição na tela
const FINANCIAL_TYPE_DISPLAY_NAMES: { [key: string]: string } = {
  'balanco': 'Balanço Patrimonial',
  'orcamento': 'Orçamento Anual',
  'prestacao-contas': 'Prestação de Contas',
  'receitas': 'Relatório de Receitas',
  'despesas': 'Relatório de Despesas',
  'licitacoes': 'Licitações e Contratos',
  'folha-pagamento': 'Folha de Pagamento',
  'outros': 'Outros'
};

@Component({
  selector: 'app-financial-documents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './financial-documents.component.html',
  styleUrls: ['./financial-documents.component.scss']
})
export class FinancialDocumentsComponent implements OnInit {
  financialFolders: FinancialFolder[] = [];
  selectedFolder: FinancialFolder | null = null;
  municipalityCode: string | null = null;
  isLoading: boolean = true;
  errorMessage: string = '';

  // Novas propriedades para visualização de documentos
  isModalVisible: boolean = false;
  modalViewerUrl: any;
  selectedDocumentId: string | null = null;
  modalIsLoading: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private documentsService: DocumentsService,
    private authService: AuthService,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit(): void {
    try {
      // Obter município da rota (admin escolhe) ou do usuário logado (user tem fixo)
      const routeMunicipalityCode = this.route.snapshot.paramMap.get('municipalityCode');
      const user = this.authService.getCurrentUser();

      if (routeMunicipalityCode) {
        // Admin acessando via seletor de município
        this.municipalityCode = routeMunicipalityCode;
        console.log('🏢 [FINANCIAL-DOCUMENTS] Município da rota (admin):', this.municipalityCode);
        this.loadFinancialTypesByMunicipality(this.municipalityCode);
      } else if (user?.municipality_code) {
        // User com município vinculado
        this.municipalityCode = user.municipality_code;
        console.log('🏢 [FINANCIAL-DOCUMENTS] Município do usuário logado:', this.municipalityCode);
        this.loadFinancialTypesByMunicipality(this.municipalityCode);
      } else {
        console.error('❌ [FINANCIAL-DOCUMENTS] Nenhum município disponível');
        this.errorMessage = 'Nenhum município disponível';
        this.isLoading = false;
      }
    } catch (error) {
      console.error('❌ [FINANCIAL-DOCUMENTS] Erro no ngOnInit:', error);
      this.errorMessage = 'Erro ao processar requisição';
      this.isLoading = false;
    }
  }

  private loadFinancialTypesByMunicipality(municipalityCode: string): void {
    const currentYear = new Date().getFullYear();
    this.documentsService.getFinancialDocumentTypes(municipalityCode, currentYear).subscribe({
      next: (response: any) => {
        console.log('📂 [FINANCIAL-DOCUMENTS] Documentos financeiros carregados:', response.data);

        // Mapear os dados do backend para incluir ícones, cores e descrições
        this.financialFolders = (response.data || []).map((item: any) => {
          const type = item.financial_document_type || '';
          const config = FINANCIAL_TYPE_CONFIG[type] || {
            icon: '📄',
            color: 'from-gray-500 to-gray-600',
            description: 'Documentos diversos'
          };

          // Usar o nome correto do mapeamento de exibição
          const displayName = FINANCIAL_TYPE_DISPLAY_NAMES[type] || config.description;

          return {
            financial_document_type: type,
            count: item.count || 0,
            name: displayName,
            icon: config.icon,
            description: config.description,
            color: config.color
          };
        });

        console.log('✅ [FINANCIAL-DOCUMENTS] Folders mapeados:', this.financialFolders);
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('❌ [FINANCIAL-DOCUMENTS] Erro ao carregar documentos financeiros:', error);

        // Verificar se o erro é devido a token expirado
        if (error.status === 401) {
          console.log('🔐 Token expirado, redirecionando para login...');
          this.authService.logout();
        } else {
          this.errorMessage = 'Erro ao carregar documentos financeiros';
        }
        this.isLoading = false;
      }
    });
  }

  selectFolder(folder: FinancialFolder): void {
    this.selectedFolder = folder;
    console.log(`📁 Pasta selecionada: ${folder.name}`, `(tipo: ${folder.financial_document_type})`);

    if (!this.municipalityCode) {
      console.error('❌ Código do município não disponível');
      return;
    }

    // Salvar município no sessionStorage
    sessionStorage.setItem('selectedMunicipalityCode', this.municipalityCode);

    // Navegar para a página de detalhes da categoria com o tipo de documento
    this.router.navigate([
      '/documentacoes-financeiras/municipality',
      this.municipalityCode,
      folder.financial_document_type
    ]);
  }

  navigateBack(): void {
    this.router.navigate(['/documentacoes-financeiras']);
  }

  getTotalDocuments(): number {
    return this.financialFolders.reduce((total, folder) => total + folder.count, 0);
  }

  viewDocument(documentId: number): void {
    console.log('🆕 Visualizando documento:', documentId);

    // FORÇAR modal a aparecer imediatamente
    this.isModalVisible = true;
    this.selectedDocumentId = documentId.toString();
    this.modalIsLoading = true;

    console.log('🔥 FORÇANDO modal visibility:', this.isModalVisible);
    console.log('🔥 Documento selecionado:', this.selectedDocumentId);

    // Criar URL segura
    const embedUrl = `https://drive.google.com/file/d/${documentId}/preview`;
    this.modalViewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    console.log('🔥 Modal URL criada:', embedUrl);

    // Registrar visualização
    this.documentsService.logView({
      documentId: documentId,
      driveFileId: documentId.toString(),
      municipalityCode: this.municipalityCode || undefined
    }).subscribe();

    // Parar loading após 1s
    setTimeout(() => {
      this.modalIsLoading = false;
      console.log('🔥 Modal loading finished');
    }, 1000);

    // JAMAIS abrir nova guia
    return; // Garante que nada mais seja executado
  }

  downloadDocument(documentId: number): void {
    console.log(`⬇️ Iniciando download de: ${documentId}`);

    const token = this.authService.getToken();
    if (!token) {
      alert('Token de autenticação não encontrado');
      return;
    }

    // Usar o método correto do DocumentsService
    this.documentsService.downloadDocument(documentId).subscribe({
      next: (response: Blob) => {
        console.log('✅ Download concluído');

        // Criar URL para o blob e fazer download
        const url = window.URL.createObjectURL(response);
        const link = document.createElement('a');
        link.href = url;
        link.download = `document-${documentId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('❌ Erro no download:', error);
        alert('Erro ao fazer download do arquivo');
      }
    });
  }
}