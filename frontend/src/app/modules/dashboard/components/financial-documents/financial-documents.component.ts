import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { DocumentsService } from '../../../../services/documents.service';
import { DocumentViewerService } from '../../../../services/document-viewer.service';
import { ModalWindowService } from '../../../../services/modal-window.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { DomSanitizer } from '@angular/platform-browser';
import { Subscription } from 'rxjs';

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
export class FinancialDocumentsComponent implements OnInit, OnDestroy {
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

  // Subscription do viewer
  private viewerStateSubscription: Subscription | null = null;

  // Flag para prevenir duplo clique
  private isOpeningDocument = false;

  // PROTEÇÃO DE EMERGÊNCIA: contador de cliques para detectar travamento
  private clickCount = 0;
  private lastClickTime = 0;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private documentsService: DocumentsService,
    private authService: AuthService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private documentViewerService: DocumentViewerService,
    public modalWindowService: ModalWindowService
  ) {
    // PROTEÇÃO: Se usuário clicar 3x em 2 segundos sem resposta, forçar reset
    if (typeof window !== 'undefined') {
      window.addEventListener('click', this.emergencyResetHandler.bind(this), true);
    }
  }

  ngOnInit(): void {
    // Assinar estado do viewer
    this.viewerStateSubscription = this.documentViewerService.state$.subscribe(state => {
      this.isModalVisible = state.isVisible;
      this.modalViewerUrl = state.viewerUrl;
      this.modalIsLoading = state.isLoading;
      // Nota: Removido cdr.detectChanges() - causava travamento em mobile
    });

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

    // Carregar em paralelo: contagem de documentos (folders) e metadados dos tipos (nomes)
    import('rxjs').then(({ forkJoin }) => {
      forkJoin({
        folders: this.documentsService.getFinancialDocumentTypes(municipalityCode, currentYear),
        allTypes: this.documentsService.getAllFinancialDocumentTypes()
      }).subscribe({
        next: (responses) => {
          const foldersData = responses.folders.data || [];
          const allTypesData = responses.allTypes.success ? responses.allTypes.data : [];

          console.log('📂 [FINANCIAL-DOCUMENTS] Folders data:', foldersData);
          console.log('📋 [FINANCIAL-DOCUMENTS] All types metadata:', allTypesData);

          // Criar mapa de metadados para busca rápida
          const typesMap = new Map(allTypesData?.map(t => [t.code, t]));

          this.financialFolders = foldersData.map((item: any) => {
            const typeCode = item.financial_document_type || '';
            const typeMetadata = typesMap.get(typeCode);

            // Tentar obter config hardcoded ou gerar dinâmica
            const hardcodedConfig = FINANCIAL_TYPE_CONFIG[typeCode];

            // Definir ícone e cor
            let icon = '📄';
            let color = 'from-gray-500 to-gray-600';

            if (hardcodedConfig) {
              icon = hardcodedConfig.icon;
              color = hardcodedConfig.color;
            } else {
              // Gerar cor baseada no código se não for hardcoded (para consistência)
              const colors = [
                'from-blue-500 to-blue-600',
                'from-green-500 to-green-600',
                'from-purple-500 to-purple-600',
                'from-yellow-500 to-yellow-600',
                'from-pink-500 to-pink-600',
                'from-indigo-500 to-indigo-600',
                'from-teal-500 to-teal-600'
              ];
              // Hash simples do código para escolher cor
              let hash = 0;
              for (let i = 0; i < typeCode.length; i++) {
                hash = typeCode.charCodeAt(i) + ((hash << 5) - hash);
              }
              const colorIndex = Math.abs(hash) % colors.length;
              color = colors[colorIndex];
              icon = '📁'; // Ícone genérico para tipos dinâmicos
            }

            // Definir Nome e Descrição
            // Prioridade: Nome do banco > Nome hardcoded > Código
            const name = typeMetadata?.name || FINANCIAL_TYPE_DISPLAY_NAMES[typeCode] || typeCode;
            const description = typeMetadata?.description || hardcodedConfig?.description || 'Documentos diversos';

            return {
              financial_document_type: typeCode,
              count: item.count || 0,
              name: name,
              icon: icon,
              description: description,
              color: color
            };
          });

          console.log('✅ [FINANCIAL-DOCUMENTS] Folders mapeados com sucesso:', this.financialFolders);
          this.isLoading = false;
        },
        error: (error: any) => {
          console.error('❌ [FINANCIAL-DOCUMENTS] Erro ao carregar dados:', error);
          if (error.status === 401) {
            this.authService.logout();
          } else {
            this.errorMessage = 'Erro ao carregar documentos financeiros';
          }
          this.isLoading = false;
        }
      });
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

  /**
   * Visualiza documento usando o serviço centralizado
   * PROTEÇÃO: Previne duplo clique
   */
  async viewDocument(documentId: number): Promise<void> {
    // Proteção contra duplo clique
    if (this.isOpeningDocument) {
      console.warn('⚠️ [FINANCIAL-DOCUMENTS] Abertura já em andamento, ignorando...');
      return;
    }

    this.isOpeningDocument = true;
    console.log('🆕 Visualizando documento:', documentId);

    try {
      // Guardar ID para referência
      this.selectedDocumentId = documentId.toString();

      // Usar serviço centralizado para abrir documento
      await this.documentViewerService.openDocument(
        documentId.toString(),
        `Documento ${documentId}`
      );

      // Registrar visualização
      this.documentsService.logView({
        documentId: documentId,
        driveFileId: documentId.toString(),
        municipalityCode: this.municipalityCode || undefined
      }).subscribe();
    } finally {
      // Liberar flag após um pequeno delay
      setTimeout(() => {
        this.isOpeningDocument = false;
      }, 300);
    }
  }

  /**
   * Fecha o modal usando o serviço centralizado
   */
  closeModal(): void {
    console.log('🔒 [FINANCIAL-DOCUMENTS] Fechando modal');
    this.selectedDocumentId = null;
    this.isOpeningDocument = false;
    this.documentViewerService.closeViewer();
  }

  ngOnDestroy(): void {
    console.log('🗑️ [FINANCIAL-DOCUMENTS] ngOnDestroy - Limpando memória');

    // Remover listener de emergência
    if (typeof window !== 'undefined') {
      window.removeEventListener('click', this.emergencyResetHandler.bind(this), true);
    }

    // Cancelar subscription do viewer
    if (this.viewerStateSubscription) {
      this.viewerStateSubscription.unsubscribe();
    }

    // Garantir que modal está fechado
    this.isOpeningDocument = false;
    this.documentViewerService.forceReset();
    this.selectedDocumentId = null;
  }

  /**
   * PROTEÇÃO DE EMERGÊNCIA: Se usuário clicar várias vezes sem resposta, força reset
   */
  private emergencyResetHandler(event: Event): void {
    const now = Date.now();
    
    // Se cliques rápidos (menos de 2s entre eles)
    if (now - this.lastClickTime < 2000) {
      this.clickCount++;
      
      // Se 3 ou mais cliques em 2 segundos
      if (this.clickCount >= 3) {
        console.warn('🚨 [EMERGÊNCIA] Detectado travamento! Forçando reset...');
        this.isOpeningDocument = false;
        this.documentViewerService.forceReset();
        this.clickCount = 0;
        
        // Feedback visual
        if (typeof window !== 'undefined' && window.navigator && 'vibrate' in window.navigator) {
          window.navigator.vibrate(200);
        }
      }
    } else {
      // Resetar contador se passou mais de 2s
      this.clickCount = 1;
    }
    
    this.lastClickTime = now;
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