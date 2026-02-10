import { Injectable } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BehaviorSubject, Subject } from 'rxjs';

/**
 * Estado do modal de visualizaÃ§Ã£o
 */
export interface ViewerState {
    isVisible: boolean;
    isLoading: boolean;
    viewerUrl: SafeResourceUrl | null;
    currentDocumentId: string | null;
    documentTitle: string;
    fileSize: number;
    isLargeFile: boolean;
}

/**
 * ServiÃ§o centralizado para gerenciamento de visualizaÃ§Ã£o de documentos.
 * 
 * VERSÃƒO SIMPLIFICADA - Foco em estabilidade para mobile
 * 
 * PROBLEMAS RESOLVIDOS:
 * - Vazamento de memÃ³ria em dispositivos mÃ³veis ao abrir mÃºltiplos documentos
 * - DestruiÃ§Ã£o incompleta de iframes do Google Drive
 * - Travamento ao fechar modal (loop de detecÃ§Ã£o de mudanÃ§as)
 * - Race condition quando usuÃ¡rio fecha antes do documento carregar
 */
@Injectable({
    providedIn: 'root'
})
export class DocumentViewerService {
    private readonly BLANK_URL = 'about:blank';

    // ConfiguraÃ§Ã£o de delays (maiores para mobile)
    private isMobile = false;
    private cleanupDelayMs = 100;

    // Limite de 100MB para visualizacao do Google Drive
    private readonly LARGE_FILE_THRESHOLD = 100 * 1024 * 1024;

    // Estado reativo do viewer
    private stateSubject = new BehaviorSubject<ViewerState>({
        isVisible: false,
        isLoading: false,
        viewerUrl: null,
        currentDocumentId: null,
        documentTitle: '',
        fileSize: 0,
        isLargeFile: false
    });

    // Observable para componentes assinarem
    public state$ = this.stateSubject.asObservable();

    // Evento de limpeza forÃ§ada
    private forceCleanupSubject = new Subject<void>();
    public forceCleanup$ = this.forceCleanupSubject.asObservable();

    // Contador para debug
    private viewCount = 0;

    // CRÃTICO: Controlar timeouts pendentes para cancelar em caso de fechamento rÃ¡pido
    private pendingOpenTimeout: any = null;
    private pendingCleanupTimeouts: any[] = [];
    
    // Flag para evitar mÃºltiplas operaÃ§Ãµes simultÃ¢neas
    private isOpening = false;

    constructor(private sanitizer: DomSanitizer) {
        this.detectMobileDevice();
        console.log('ðŸ“± [DocumentViewerService] Inicializado. Mobile:', this.isMobile);
    }

    /**
     * Detecta se estÃ¡ em dispositivo mÃ³vel
     */
    private detectMobileDevice(): void {
        if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
            const userAgent = navigator.userAgent.toLowerCase();
            this.isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

            if (this.isMobile) {
                this.cleanupDelayMs = 300; // Mais tempo para GC em mobile
                console.log('ðŸ“± [DocumentViewerService] Modo mobile ativado');
            }
        }
    }

    /**
     * ObtÃ©m o estado atual
     */
    get currentState(): ViewerState {
        return this.stateSubject.getValue();
    }

    /**
     * Verifica se hÃ¡ um documento atualmente sendo exibido
     */
    get isDocumentOpen(): boolean {
        return this.currentState.isVisible;
    }

    /**
     * Abre um documento no modal.
     * Usa setTimeout para evitar bloqueio da UI.
     * PROTEÃ‡ÃƒO: Cancela operaÃ§Ãµes pendentes se usuÃ¡rio fechar antes de carregar.
     */
    openDocument(documentId: string, title: string, customUrl?: string, fileSize: number = 0): Promise<boolean> {
        return new Promise((resolve) => {
            console.log(`ðŸ“– [DocumentViewerService] Abrindo documento: ${title} (${documentId})`);

            // PROTEÃ‡ÃƒO 1: Se jÃ¡ estÃ¡ abrindo outro documento, aguardar um momento
            if (this.isOpening) {
                console.warn('âš ï¸ [DocumentViewerService] JÃ¡ hÃ¡ abertura em andamento, aguardando...');
                setTimeout(() => this.openDocument(documentId, title, customUrl, fileSize).then(resolve), 100);
                return;
            }

            this.isOpening = true;

            // PROTEÃ‡ÃƒO 2: Cancelar qualquer timeout pendente de abertura anterior
            if (this.pendingOpenTimeout) {
                console.log('ðŸš« [DocumentViewerService] Cancelando abertura pendente...');
                clearTimeout(this.pendingOpenTimeout);
                this.pendingOpenTimeout = null;
            }

            // Se jÃ¡ tem documento aberto, fechar primeiro de forma SÃNCRONA
            if (this.currentState.isVisible || this.currentState.viewerUrl) {
                console.log('ðŸ§¹ [DocumentViewerService] Fechando documento anterior...');
                this.immediateCleanup();
            }

            this.viewCount++;

            const isLargeFile = fileSize > this.LARGE_FILE_THRESHOLD;

            // Para arquivos grandes, nao tentar carregar iframe - Google Drive nao suporta preview > 100MB
            if (isLargeFile) {
                console.log('[DocumentViewerService] Arquivo grande - exibindo opcoes de download');
                this.stateSubject.next({
                    isVisible: true,
                    isLoading: false,
                    viewerUrl: null,
                    currentDocumentId: documentId,
                    documentTitle: title,
                    fileSize: fileSize,
                    isLargeFile: true
                });
                this.isOpening = false;
                resolve(true);
                return;
            }

            // Preparar URL do viewer
            let viewerUrl: SafeResourceUrl;
            if (customUrl) {
                viewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(customUrl);
            } else {
                const embedUrl = `https://drive.google.com/file/d/${documentId}/preview`;
                viewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
            }

            // Mostrar loading primeiro
            this.stateSubject.next({
                isVisible: true,
                isLoading: true,
                viewerUrl: null,
                currentDocumentId: documentId,
                documentTitle: title,
                fileSize: fileSize,
                isLargeFile: false
            });

            // Carregar iframe apÃ³s pequeno delay (permite DOM atualizar)
            this.pendingOpenTimeout = setTimeout(() => {
                // PROTEÃ‡ÃƒO 3: Verificar se nÃ£o foi fechado durante o delay
                if (!this.currentState.isVisible) {
                    console.warn('âš ï¸ [DocumentViewerService] Modal foi fechado durante carregamento, abortando...');
                    this.isOpening = false;
                    this.pendingOpenTimeout = null;
                    resolve(false);
                    return;
                }

                this.stateSubject.next({
                    ...this.currentState,
                    viewerUrl: viewerUrl,
                    isLoading: false
                });
                console.log(`âœ… [DocumentViewerService] Documento carregado: ${title}`);
                this.isOpening = false;
                this.pendingOpenTimeout = null;
                resolve(true);
            }, this.isMobile ? 150 : 50);

            // CRÃTICO: Liberar flag de abertura apÃ³s pequeno delay (mesmo se cancelado)
            // Isso garante que nÃ£o fique travado se o usuÃ¡rio fechar muito rÃ¡pido
            setTimeout(() => {
                if (this.isOpening) {
                    console.log('ðŸ”“ [DocumentViewerService] Liberando flag de seguranÃ§a...');
                    this.isOpening = false;
                }
            }, 500);
        });
    }

    /**
     * Notifica que o iframe terminou de carregar
     */
    onIframeLoaded(): void {
        if (this.currentState.isLoading) {
            this.stateSubject.next({
                ...this.currentState,
                isLoading: false
            });
        }
        console.log('âœ… [DocumentViewerService] Iframe carregado');
    }

    /**
     * Fecha o modal e limpa recursos.
     * Usa abordagem assÃ­ncrona com setTimeout para nÃ£o bloquear UI.
     * PROTEÃ‡ÃƒO: Cancela timeouts pendentes de abertura para evitar race condition.
     */
    closeViewer(): Promise<void> {
        return new Promise((resolve) => {
            console.log('ðŸ”’ [DocumentViewerService] Fechando viewer...');

            // CRÃTICO: Cancelar timeout pendente de abertura (se usuÃ¡rio fechou rÃ¡pido)
            if (this.pendingOpenTimeout) {
                console.log('ðŸš« [DocumentViewerService] Cancelando carregamento pendente...');
                clearTimeout(this.pendingOpenTimeout);
                this.pendingOpenTimeout = null;
            }

            // Limpar flag de operaÃ§Ã£o
            this.isOpening = false;

            // PASSO 1: Esconder modal imediatamente (UX responsiva)
            this.stateSubject.next({
                ...this.currentState,
                isVisible: false
            });

            // PASSO 2: Navegar para about:blank (libera recursos do Google Drive)
            const timeout1 = setTimeout(() => {
                if (this.currentState.viewerUrl) {
                    console.log('ðŸ”„ [DocumentViewerService] Navegando para about:blank...');
                    this.stateSubject.next({
                        ...this.currentState,
                        viewerUrl: this.sanitizer.bypassSecurityTrustResourceUrl(this.BLANK_URL)
                    });
                }

                // PASSO 3: Remover iframe completamente apÃ³s delay
                const timeout2 = setTimeout(() => {
                    console.log('ðŸ—‘ï¸ [DocumentViewerService] Removendo iframe...');
                    this.stateSubject.next({
                        isVisible: false,
                        isLoading: false,
                        viewerUrl: null,
                        currentDocumentId: null,
                        documentTitle: '',
                        fileSize: 0,
                        isLargeFile: false
                    });
                    console.log('âœ… [DocumentViewerService] Limpeza concluÃ­da');
                    
                    // Limpar da lista de timeouts pendentes
                    this.pendingCleanupTimeouts = this.pendingCleanupTimeouts.filter(t => t !== timeout1 && t !== timeout2);
                    
                    resolve();
                }, this.cleanupDelayMs);

                this.pendingCleanupTimeouts.push(timeout2);

            }, 50);

            this.pendingCleanupTimeouts.push(timeout1);
        });
    }

    /**
     * Limpeza imediata e sÃ­ncrona (para usar antes de abrir novo documento)
     */
    private immediateCleanup(): void {
        console.log('âš¡ [DocumentViewerService] Limpeza imediata');
        
        // Cancelar todos os timeouts pendentes
        if (this.pendingOpenTimeout) {
            clearTimeout(this.pendingOpenTimeout);
            this.pendingOpenTimeout = null;
        }
        
        this.pendingCleanupTimeouts.forEach(timeout => clearTimeout(timeout));
        this.pendingCleanupTimeouts = [];
        
        this.isOpening = false;
        
        this.stateSubject.next({
            isVisible: false,
            isLoading: false,
            viewerUrl: null,
            currentDocumentId: null,
            documentTitle: '',
            fileSize: 0,
            isLargeFile: false
        });
    }

    /**
     * ForÃ§a reset completo do serviÃ§o
     */
    forceReset(): void {
        console.log('ðŸ”„ [DocumentViewerService] Reset forÃ§ado');
        
        // Cancelar TODOS os timeouts
        if (this.pendingOpenTimeout) {
            clearTimeout(this.pendingOpenTimeout);
            this.pendingOpenTimeout = null;
        }
        
        this.pendingCleanupTimeouts.forEach(timeout => clearTimeout(timeout));
        this.pendingCleanupTimeouts = [];
        
        this.isOpening = false;
        
        this.forceCleanupSubject.next();
        this.immediateCleanup();
        this.viewCount = 0;
    }

    /**
     * ObtÃ©m estatÃ­sticas para debug
     */
    getDebugStats(): { viewCount: number; isMobile: boolean } {
        return {
            viewCount: this.viewCount,
            isMobile: this.isMobile
        };
    }
}






