import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DocumentsService } from '../../../../services/documents.service';
import { DocumentViewerService } from '../../../../services/document-viewer.service';
import { ModalWindowService } from '../../../../services/modal-window.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../../../environments/environment';
import { Subscription } from 'rxjs';

interface SearchResult {
    id: number;
    title: string;
    type: 'server' | 'financial';
    file_name?: string;
    drive_file_id?: string;
    google_drive_id?: string;
    year?: number;
    financial_year?: number;
    financial_document_type?: string;
    category?: string;
    gender?: string;
    created_at: string;
    municipality_code?: string;
    municipality_name?: string;
    mime_type?: string;
    file_size?: number;
    server_name?: string;
}

@Component({
    selector: 'app-advanced-search',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatIconModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './advanced-search.component.html',
    styleUrls: ['./advanced-search.component.scss']
})
export class AdvancedSearchComponent implements OnInit, OnDestroy {
    searchForm!: FormGroup;
    municipalityCode: string | null = null;
    municipalityName: string = '';
    isLoading = false;
    searchResults: SearchResult[] = [];
    hasSearched = false;
    currentUser: any;

    // Filter options
    years: number[] = [];
    documentTypes = [
        { value: 'all', label: 'Todos' },
        { value: 'server', label: 'Servidores' },
        { value: 'financial', label: 'Documentos Financeiros' }
    ];

    // Modal state
    isModalVisible = false;
    selectedFile: SearchResult | null = null;
    modalViewerUrl: SafeResourceUrl | null = null;
    modalIsLoading = false;

    // Subscription do viewer
    private viewerStateSubscription: Subscription | null = null;

    constructor(
        private fb: FormBuilder,
        private router: Router,
        private route: ActivatedRoute,
        private documentsService: DocumentsService,
        private authService: AuthService,
        private http: HttpClient,
        private sanitizer: DomSanitizer,
        private cdr: ChangeDetectorRef,
        private documentViewerService: DocumentViewerService,
        public modalWindowService: ModalWindowService
    ) {
        this.initializeYears();
    }

    ngOnInit(): void {
        this.currentUser = this.authService.getCurrentUser();

        // Get municipality from route or user
        const routeMunicipalityCode = this.route.snapshot.paramMap.get('municipalityCode');

        if (routeMunicipalityCode) {
            this.municipalityCode = routeMunicipalityCode;
        } else if (this.currentUser?.municipality_code) {
            this.municipalityCode = this.currentUser.municipality_code;
        }

        this.initializeForm();
        this.loadMunicipalityName();

        // Assinar estado do viewer
        this.viewerStateSubscription = this.documentViewerService.state$.subscribe(state => {
            this.isModalVisible = state.isVisible;
            this.modalViewerUrl = state.viewerUrl;
            this.modalIsLoading = state.isLoading;
            this.cdr.detectChanges();
        });

        if (this.municipalityCode) {
            this.loadSearchOptions();
        } else {
            this.initializeYears(); // Fallback
        }
    }

    ngOnDestroy(): void {
        console.log('🗑️ [ADVANCED-SEARCH] ngOnDestroy - Limpando memória');

        // Cancelar subscription do viewer
        if (this.viewerStateSubscription) {
            this.viewerStateSubscription.unsubscribe();
        }

        // Garantir que modal está fechado
        this.documentViewerService.closeViewer();
        this.selectedFile = null;
    }

    private initializeForm(): void {
        this.searchForm = this.fb.group({
            query: [''],
            year: ['all'],
            documentType: ['all'],
            dateFrom: [''],
            dateTo: ['']
        });
    }

    private initializeYears(): void {
        const currentYear = new Date().getFullYear();
        this.years = [];
        for (let year = currentYear; year >= currentYear - 20; year--) {
            this.years.push(year);
        }
    }

    private loadSearchOptions(): void {
        if (!this.municipalityCode) return;

        console.log('🔄 Carregando opções de pesquisa para:', this.municipalityCode);

        this.documentsService.getSearchOptions(this.municipalityCode).subscribe({
            next: (response) => {
                if (response.success && response.data) {
                    // Update Years
                    if (response.data.years && response.data.years.length > 0) {
                        this.years = response.data.years;
                    }

                    // Update Document Types
                    const types = response.data.types || [];
                    this.documentTypes = [{ value: 'all', label: 'Todos' }];

                    if (types.includes('servidor')) {
                        this.documentTypes.push({ value: 'server', label: 'Servidores' });
                    }
                    if (types.includes('financeiro')) {
                        this.documentTypes.push({ value: 'financial', label: 'Documentos Financeiros' });
                    }

                    console.log('✅ Opções atualizadas:', {
                        years: this.years,
                        types: this.documentTypes
                    });
                }
            },
            error: (error) => {
                console.error('❌ Erro ao carregar opções:', error);
                // Fallback to default options if error
                this.initializeYears();
            }
        });
    }

    private loadMunicipalityName(): void {
        if (!this.municipalityCode) return;

        this.documentsService.getMunicipalities().subscribe({
            next: (response) => {
                if (response.success && response.data) {
                    const municipality = response.data.find((m: any) => m.code === this.municipalityCode);
                    this.municipalityName = municipality ? municipality.name : (this.municipalityCode || '');
                }
            },
            error: (error) => {
                console.error('Erro ao carregar município:', error);
                this.municipalityName = this.municipalityCode || '';
            }
        });
    }

    onSearch(): void {
        if (!this.municipalityCode) {
            console.error('Município não definido');
            return;
        }

        this.isLoading = true;
        this.hasSearched = true;

        const filters = {
            municipalityCode: this.municipalityCode,
            ...this.searchForm.value
        };

        // Remove 'all' values
        Object.keys(filters).forEach(key => {
            if (filters[key] === 'all') {
                delete filters[key];
            }
        });

        console.log('🔍 Buscando com filtros:', filters);

        this.documentsService.advancedSearch(filters).subscribe({
            next: (response) => {
                this.isLoading = false;
                if (response.success && response.data) {
                    this.searchResults = response.data;
                    console.log(`✅ Encontrados ${this.searchResults.length} resultados`);
                } else {
                    this.searchResults = [];
                    console.log('⚠️ Nenhum resultado encontrado');
                }
            },
            error: (error) => {
                this.isLoading = false;
                this.searchResults = [];
                console.error('❌ Erro na busca:', error);
            }
        });
    }

    clearFilters(): void {
        this.searchForm.reset({
            query: '',
            year: 'all',
            documentType: 'all',
            dateFrom: '',
            dateTo: ''
        });
        this.searchResults = [];
        this.hasSearched = false;
    }

    /**
     * Visualiza documento usando o serviço centralizado
     */
    async viewDocument(result: SearchResult): Promise<void> {
        console.log('Visualizando documento:', result);

        // Guardar referência do arquivo para exibição de metadados
        this.selectedFile = result;

        const driveFileId = result.drive_file_id || result.google_drive_id;

        if (!driveFileId) {
            // Tentar URL alternativa
            if ((result as any).file_path) {
                const filePath = (result as any).file_path.replace('/view', '/preview');
                await this.documentViewerService.openDocument(
                    'custom',
                    result.title || result.file_name || 'Documento',
                    filePath
                );
            } else {
                console.error('Nenhum ID do Drive ou caminho de arquivo encontrado');
                return;
            }
        } else {
            // Usar serviço centralizado para abrir documento
            await this.documentViewerService.openDocument(
                driveFileId,
                result.title || result.file_name || 'Documento'
            );
        }

        // Registrar visualização
        this.documentsService.logView({
            documentId: result.id,
            driveFileId: driveFileId,
            fileName: result.file_name || result.title,
            municipalityCode: this.municipalityCode || undefined
        }).subscribe();
    }

    /**
     * Fecha o modal usando o serviço centralizado
     */
    async closeModal(): Promise<void> {
        console.log('🔒 [ADVANCED-SEARCH] Fechando modal');
        this.selectedFile = null;
        await this.documentViewerService.closeViewer();
    }

    downloadDocument(result: SearchResult): void {
        console.log(`⬇️ Iniciando download de: ${result.title}`);

        const driveFileId = result.drive_file_id || result.google_drive_id;

        if (!driveFileId) {
            alert('Arquivo não disponível para download');
            return;
        }

        const token = this.authService.getToken();
        if (!token) {
            alert('Token de autenticação não encontrado');
            return;
        }

        // Usar endpoint de download específico para Google Drive
        this.http.get(`${environment.apiUrl}/documents/drive/${driveFileId}/download`, {
            headers: { 'Authorization': `Bearer ${token}` },
            responseType: 'blob',
            observe: 'response'
        }).subscribe({
            next: (response) => {
                const blob = response.body;
                if (blob) {
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = result.file_name || result.title;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                }
            },
            error: (error) => {
                console.error('❌ Erro no download:', error);
                alert('Erro ao fazer download do arquivo');
            }
        });
    }

    navigateBack(): void {
        if (this.currentUser?.role === 'admin') {
            this.router.navigate(['/busca-avancada']);
        } else {
            this.router.navigate(['/dashboard']);
        }
    }

    getDocumentIcon(result: SearchResult): string {
        const type = this.getDisplayType(result);
        return type === 'server' ? 'people' : 'folder_open';
    }

    getDisplayType(result: SearchResult): 'server' | 'financial' {
        // override strict backend type if it seems wrong
        if (result.type === 'server') {
            // If it's markers as server but has no server_name, it's safer to show as "Documento" (Financial style)
            if (!result.server_name) {
                return 'financial';
            }
        }
        return result.type;
    }

    getDocumentTypeLabel(result: SearchResult): string {
        const type = this.getDisplayType(result);
        return type === 'server' ? 'Servidor' : 'Documentação Financeira';
    }

    getDocumentSubtitle(result: SearchResult): string {
        const type = this.getDisplayType(result);

        if (type === 'server') {
            return result.server_name || 'Servidor sem nome';
        } else {
            // For financial documents: "Folder Name + Year"
            // Folder name comes from 'financial_document_type' (e.g., "despesas") or 'category'

            const doc = result as any;
            let folderName = doc.financial_document_type || doc.category || 'Documento';

            // Capitalize first letter
            if (folderName && typeof folderName === 'string') {
                folderName = folderName.charAt(0).toUpperCase() + folderName.slice(1).toLowerCase();
            }

            const year = doc.financial_year || doc.year || '';

            return `${folderName} ${year}`.trim();
        }
    }

    formatDate(dateString: string): string {
        return new Date(dateString).toLocaleDateString('pt-BR');
    }
}
