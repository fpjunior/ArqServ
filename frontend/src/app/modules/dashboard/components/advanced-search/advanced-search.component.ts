import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DocumentsService } from '../../../../services/documents.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../../../environments/environment';

interface SearchResult {
    id: number;
    title: string;
    type: 'server' | 'financial';
    file_name?: string;
    drive_file_id?: string;
    google_drive_id?: string;
    year?: number;
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
    genderOptions = [
        { value: 'all', label: 'Todos' },
        { value: 'M', label: 'Masculino' },
        { value: 'F', label: 'Feminino' }
    ];

    // Modal state
    isModalVisible = false;
    selectedFile: SearchResult | null = null;
    modalViewerUrl: SafeResourceUrl | null = null;
    modalIsLoading = false;

    constructor(
        private fb: FormBuilder,
        private router: Router,
        private route: ActivatedRoute,
        private documentsService: DocumentsService,
        private authService: AuthService,
        private http: HttpClient,
        private sanitizer: DomSanitizer,
        private cdr: ChangeDetectorRef
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
    }

    ngOnDestroy(): void {
        console.log('🗑️ [ADVANCED-SEARCH] ngOnDestroy - Limpando memória');
        this.modalViewerUrl = null;
        this.selectedFile = null;
    }

    private initializeForm(): void {
        this.searchForm = this.fb.group({
            query: [''],
            year: ['all'],
            documentType: ['all'],
            gender: ['all'],
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
            gender: 'all',
            dateFrom: '',
            dateTo: ''
        });
        this.searchResults = [];
        this.hasSearched = false;
    }

    viewDocument(result: SearchResult): void {
        console.log('Visualizando documento:', result);

        this.isModalVisible = true;
        this.selectedFile = result;
        this.modalIsLoading = true;

        const driveFileId = result.drive_file_id || result.google_drive_id;

        if (driveFileId) {
            const embedUrl = `https://drive.google.com/file/d/${driveFileId}/preview`;
            this.modalViewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
            console.log('🔥 Modal URL criada:', embedUrl);
        } else if ((result as any).file_path) {
            // Fallback if file_path is viewable directly
            const filePath = (result as any).file_path.replace('/view', '/preview');
            this.modalViewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(filePath);
        }

        // Registrar visualização
        this.documentsService.logView({
            documentId: result.id,
            driveFileId: driveFileId,
            fileName: result.file_name || result.title,
            municipalityCode: this.municipalityCode || undefined
        }).subscribe();

        setTimeout(() => {
            this.modalIsLoading = false;
        }, 1000);
    }

    closeModal(): void {
        console.log('🔒 [MOBILE-FIX] Fechando modal e limpando memória...');

        // PASSO 1: Limpar URL do iframe IMEDIATAMENTE
        this.modalViewerUrl = null;
        this.modalIsLoading = false;

        // PASSO 2: Forçar detecção de mudanças para remover iframe do DOM AGORA
        this.cdr.detectChanges();

        // PASSO 3: Aguardar um ciclo de renderização para garantir remoção do DOM
        setTimeout(() => {
            this.selectedFile = null;
            this.isModalVisible = false;

            // PASSO 4: Forçar outra detecção para garantir que o modal foi removido
            this.cdr.detectChanges();
            console.log('✅ [MOBILE-FIX] Modal completamente removido do DOM');
        }, 100);
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

    getDocumentIcon(type: string): string {
        return type === 'server' ? 'people' : 'account_balance';
    }

    getDocumentTypeLabel(type: string): string {
        return type === 'server' ? 'Servidor' : 'Financeiro';
    }

    formatDate(dateString: string): string {
        return new Date(dateString).toLocaleDateString('pt-BR');
    }
}
