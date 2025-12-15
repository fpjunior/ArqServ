import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DocumentsService } from '../../../../services/documents.service';

@Component({
    selector: 'app-financial-year-selector',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './financial-year-selector.component.html',
    styleUrls: ['./financial-year-selector.component.scss']
})
export class FinancialYearSelectorComponent implements OnInit {
    years: number[] = [];
    isLoading: boolean = true;
    municipalityCode: string = '';
    category: string = '';
    errorMessage: string = '';

    // Configuração visual para o header (similar ao categories)
    categoryInfo: any = null;

    categoryConfigs: { [key: string]: { name: string, icon: string, description: string, color: string } } = {
        'balanco': { name: 'Balanço Patrimonial', icon: '⚖️', description: 'Documentos de balanço patrimonial', color: 'from-indigo-500 to-indigo-600' },
        'orcamento': { name: 'Orçamento Anual', icon: '📊', description: 'Documentos de orçamento anual', color: 'from-cyan-500 to-cyan-600' },
        'prestacao-contas': { name: 'Prestação de Contas', icon: '🔍', description: 'Documentos de prestação de contas', color: 'from-orange-500 to-orange-600' },
        'receitas': { name: 'Relatório de Receitas', icon: '📈', description: 'Documentos de receitas e arrecadação', color: 'from-green-500 to-green-600' },
        'despesas': { name: 'Relatório de Despesas', icon: '📉', description: 'Relatórios de despesas', color: 'from-red-500 to-red-600' },
        'licitacoes': { name: 'Licitações e Contratos', icon: '📋', description: 'Documentos de processos licitatórios e contratos', color: 'from-blue-500 to-blue-600' },
        'folha-pagamento': { name: 'Folha de Pagamento', icon: '💰', description: 'Documentos de folha de pagamento', color: 'from-purple-500 to-purple-600' },
        'outros': { name: 'Outros', icon: '📎', description: 'Outros documentos financeiros', color: 'from-gray-500 to-gray-600' }
    };

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private documentsService: DocumentsService
    ) { }

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            this.municipalityCode = params['municipalityCode'];
            this.category = params['category'];

            // Tentar config hardcoded primeiro
            const hardcodedConfig = this.categoryConfigs[this.category];

            if (hardcodedConfig) {
                this.categoryInfo = hardcodedConfig;
            } else {
                // Config temporária com fallback para o código
                this.categoryInfo = {
                    name: this.category,
                    icon: '📂',
                    description: 'Documentos',
                    color: 'from-gray-500 to-gray-600'
                };

                // Buscar nome real no backend
                this.loadCategoryMetadata();
            }

            if (this.municipalityCode && this.category) {
                this.loadYears();
            } else {
                this.errorMessage = 'Parâmetros inválidos';
                this.isLoading = false;
            }
        });
    }

    loadCategoryMetadata(): void {
        // Buscar todos os tipos para encontrar o nome correto
        this.documentsService.getAllFinancialDocumentTypes().subscribe({
            next: (response) => {
                if (response.success && response.data) {
                    const typeData = response.data.find(t => t.code === this.category);
                    if (typeData) {
                        console.log('✅ Metadados do tipo encontrados:', typeData);
                        // Atualizar visualização com dados do banco
                        this.categoryInfo = {
                            ...this.categoryInfo,
                            name: typeData.name,
                            description: typeData.description || this.categoryInfo.description
                        };
                    }
                }
            },
            error: (err) => console.error('Erro ao carregar metadados do tipo:', err)
        });
    }

    loadYears(): void {
        this.isLoading = true;
        this.documentsService.getFinancialYearsByType(this.municipalityCode, this.category)
            .subscribe({
                next: (response) => {
                    if (response.success && response.data) {
                        this.years = response.data;
                    } else {
                        this.years = [];
                    }
                    this.isLoading = false;
                },
                error: (error) => {
                    console.error('Erro ao buscar anos:', error);
                    this.errorMessage = 'Erro ao carregar anos disponíveis';
                    this.isLoading = false;
                }
            });
    }

    selectYear(year: number): void {
        this.router.navigate([
            '/documentacoes-financeiras/municipality',
            this.municipalityCode,
            this.category,
            year
        ]);
    }

    navigateBack(): void {
        this.router.navigate(['/documentacoes-financeiras/municipality', this.municipalityCode]);
    }
}
