import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { DocumentsService } from '../../../../services/documents.service';
import { AuthService } from '../../../../shared/services/auth.service';

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
  'folha-pagamento': { icon: '💰', color: 'from-blue-500 to-blue-600', description: 'Folha de Pagamento' },
  'despesas': { icon: '💸', color: 'from-red-500 to-red-600', description: 'Relatório de Despesas' },
  'receitas': { icon: '💰', color: 'from-green-500 to-green-600', description: 'Relatório de Receitas' },
  'contratos': { icon: '📝', color: 'from-purple-500 to-purple-600', description: 'Contratos firmados e documentação' },
  'licitações': { icon: '📋', color: 'from-blue-500 to-blue-600', description: 'Documentos de processos licitatórios' },
  'orçamento anual': { icon: '📊', color: 'from-cyan-500 to-cyan-600', description: 'Documentos de orçamento anual' },
  'planejamento': { icon: '📊', color: 'from-cyan-500 to-cyan-600', description: 'Documentos de planejamento' },
  'conformidade': { icon: '✅', color: 'from-green-600 to-green-700', description: 'Documentos de conformidade e auditoria' },
  'prestação de contas': { icon: '🔍', color: 'from-orange-500 to-orange-600', description: 'Prestação de contas e relatórios' }
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

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private documentsService: DocumentsService,
    private authService: AuthService
  ) {}

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
    this.documentsService.getFinancialDocumentTypes(municipalityCode).subscribe({
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
          
          return {
            financial_document_type: type,
            count: item.count || 0,
            name: item.display_name || config.description,
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
    this.router.navigate(['/dashboard']);
  }

  getTotalDocuments(): number {
    return this.financialFolders.reduce((total, folder) => total + folder.count, 0);
  }
}