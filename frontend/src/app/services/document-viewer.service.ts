import { Injectable } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BehaviorSubject, Subject } from 'rxjs';

/**
 * Estado do modal de visualização
 */
export interface ViewerState {
    isVisible: boolean;
    isLoading: boolean;
    viewerUrl: SafeResourceUrl | null;
    currentDocumentId: string | null;
    documentTitle: string;
}

/**
 * Serviço centralizado para gerenciamento de visualização de documentos.
 * 
 * VERSÃO SIMPLIFICADA - Foco em estabilidade para mobile
 * 
 * PROBLEMAS RESOLVIDOS:
 * - Vazamento de memória em dispositivos móveis ao abrir múltiplos documentos
 * - Destruição incompleta de iframes do Google Drive
 * - Travamento ao fechar modal (loop de detecção de mudanças)
 * - Race condition quando usuário fecha antes do documento carregar
 */
@Injectable({
    providedIn: 'root'
})
export class DocumentViewerService {
    private readonly BLANK_URL = 'about:blank';

    // Configuração de delays (maiores para mobile)
    private isMobile = false;
    private cleanupDelayMs = 100;

    // Estado reativo do viewer
    private stateSubject = new BehaviorSubject<ViewerState>({
        isVisible: false,
        isLoading: false,
        viewerUrl: null,
        currentDocumentId: null,
        documentTitle: ''
    });

    // Observable para componentes assinarem
    public state$ = this.stateSubject.asObservable();

    // Evento de limpeza forçada
    private forceCleanupSubject = new Subject<void>();
    public forceCleanup$ = this.forceCleanupSubject.asObservable();

    // Contador para debug
    private viewCount = 0;

    // CRÍTICO: Controlar timeouts pendentes para cancelar em caso de fechamento rápido
    private pendingOpenTimeout: any = null;
    private pendingCleanupTimeouts: any[] = [];
    
    // Flag para evitar múltiplas operações simultâneas
    private isOpening = false;

    constructor(private sanitizer: DomSanitizer) {
        this.detectMobileDevice();
        console.log('📱 [DocumentViewerService] Inicializado. Mobile:', this.isMobile);
    }

    /**
     * Detecta se está em dispositivo móvel
     */
    private detectMobileDevice(): void {
        if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
            const userAgent = navigator.userAgent.toLowerCase();
            this.isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

            if (this.isMobile) {
                this.cleanupDelayMs = 300; // Mais tempo para GC em mobile
                console.log('📱 [DocumentViewerService] Modo mobile ativado');
            }
        }
    }

    /**
     * Obtém o estado atual
     */
    get currentState(): ViewerState {
        return this.stateSubject.getValue();
    }

    /**
     * Verifica se há um documento atualmente sendo exibido
     */
    get isDocumentOpen(): boolean {
        return this.currentState.isVisible;
    }

    /**
     * Abre um documento no modal.
     * Usa setTimeout para evitar bloqueio da UI.
     * PROTEÇÃO: Cancela operações pendentes se usuário fechar antes de carregar.
     */
    openDocument(documentId: string, title: string, customUrl?: string): Promise<boolean> {
        return new Promise((resolve) => {
            console.log(`📖 [DocumentViewerService] Abrindo documento: ${title} (${documentId})`);

            // PROTEÇÃO 1: Se já está abrindo outro documento, aguardar um momento
            if (this.isOpening) {
                console.warn('⚠️ [DocumentViewerService] Já há abertura em andamento, aguardando...');
                setTimeout(() => this.openDocument(documentId, title, customUrl).then(resolve), 100);
                return;
            }

            this.isOpening = true;

            // PROTEÇÃO 2: Cancelar qualquer timeout pendente de abertura anterior
            if (this.pendingOpenTimeout) {
                console.log('🚫 [DocumentViewerService] Cancelando abertura pendente...');
                clearTimeout(this.pendingOpenTimeout);
                this.pendingOpenTimeout = null;
            }

            // Se já tem documento aberto, fechar primeiro de forma SÍNCRONA
            if (this.currentState.isVisible || this.currentState.viewerUrl) {
                console.log('🧹 [DocumentViewerService] Fechando documento anterior...');
                this.immediateCleanup();
            }

            this.viewCount++;

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
                documentTitle: title
            });

            // Carregar iframe após pequeno delay (permite DOM atualizar)
            this.pendingOpenTimeout = setTimeout(() => {
                // PROTEÇÃO 3: Verificar se não foi fechado durante o delay
                if (!this.currentState.isVisible) {
                    console.warn('⚠️ [DocumentViewerService] Modal foi fechado durante carregamento, abortando...');
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
                console.log(`✅ [DocumentViewerService] Documento carregado: ${title}`);
                this.isOpening = false;
                this.pendingOpenTimeout = null;
                resolve(true);
            }, this.isMobile ? 150 : 50);
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
        console.log('✅ [DocumentViewerService] Iframe carregado');
    }

    /**
     * Fecha o modal e limpa recursos.
     * Usa abordagem assíncrona com setTimeout para não bloquear UI.
     * PROTEÇÃO: Cancela timeouts pendentes de abertura para evitar race condition.
     */
    closeViewer(): Promise<void> {
        return new Promise((resolve) => {
            console.log('🔒 [DocumentViewerService] Fechando viewer...');

            // CRÍTICO: Cancelar timeout pendente de abertura (se usuário fechou rápido)
            if (this.pendingOpenTimeout) {
                console.log('🚫 [DocumentViewerService] Cancelando carregamento pendente...');
                clearTimeout(this.pendingOpenTimeout);
                this.pendingOpenTimeout = null;
            }

            // Limpar flag de operação
            this.isOpening = false;

            // PASSO 1: Esconder modal imediatamente (UX responsiva)
            this.stateSubject.next({
                ...this.currentState,
                isVisible: false
            });

            // PASSO 2: Navegar para about:blank (libera recursos do Google Drive)
            const timeout1 = setTimeout(() => {
                if (this.currentState.viewerUrl) {
                    console.log('🔄 [DocumentViewerService] Navegando para about:blank...');
                    this.stateSubject.next({
                        ...this.currentState,
                        viewerUrl: this.sanitizer.bypassSecurityTrustResourceUrl(this.BLANK_URL)
                    });
                }

                // PASSO 3: Remover iframe completamente após delay
                const timeout2 = setTimeout(() => {
                    console.log('🗑️ [DocumentViewerService] Removendo iframe...');
                    this.stateSubject.next({
                        isVisible: false,
                        isLoading: false,
                        viewerUrl: null,
                        currentDocumentId: null,
                        documentTitle: ''
                    });
                    console.log('✅ [DocumentViewerService] Limpeza concluída');
                    
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
     * Limpeza imediata e síncrona (para usar antes de abrir novo documento)
     */
    private immediateCleanup(): void {
        console.log('⚡ [DocumentViewerService] Limpeza imediata');
        
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
            documentTitle: ''
        });
    }

    /**
     * Força reset completo do serviço
     */
    forceReset(): void {
        console.log('🔄 [DocumentViewerService] Reset forçado');
        
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
     * Obtém estatísticas para debug
     */
    getDebugStats(): { viewCount: number; isMobile: boolean } {
        return {
            viewCount: this.viewCount,
            isMobile: this.isMobile
        };
    }
}
