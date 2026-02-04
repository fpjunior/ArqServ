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
     */
    openDocument(documentId: string, title: string, customUrl?: string): Promise<boolean> {
        return new Promise((resolve) => {
            console.log(`📖 [DocumentViewerService] Abrindo documento: ${title} (${documentId})`);

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
            setTimeout(() => {
                this.stateSubject.next({
                    ...this.currentState,
                    viewerUrl: viewerUrl,
                    isLoading: false
                });
                console.log(`✅ [DocumentViewerService] Documento carregado: ${title}`);
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
     */
    closeViewer(): Promise<void> {
        return new Promise((resolve) => {
            console.log('🔒 [DocumentViewerService] Fechando viewer...');

            // PASSO 1: Esconder modal imediatamente (UX responsiva)
            this.stateSubject.next({
                ...this.currentState,
                isVisible: false
            });

            // PASSO 2: Navegar para about:blank (libera recursos do Google Drive)
            setTimeout(() => {
                if (this.currentState.viewerUrl) {
                    console.log('🔄 [DocumentViewerService] Navegando para about:blank...');
                    this.stateSubject.next({
                        ...this.currentState,
                        viewerUrl: this.sanitizer.bypassSecurityTrustResourceUrl(this.BLANK_URL)
                    });
                }

                // PASSO 3: Remover iframe completamente após delay
                setTimeout(() => {
                    console.log('🗑️ [DocumentViewerService] Removendo iframe...');
                    this.stateSubject.next({
                        isVisible: false,
                        isLoading: false,
                        viewerUrl: null,
                        currentDocumentId: null,
                        documentTitle: ''
                    });
                    console.log('✅ [DocumentViewerService] Limpeza concluída');
                    resolve();
                }, this.cleanupDelayMs);

            }, 50);
        });
    }

    /**
     * Limpeza imediata e síncrona (para usar antes de abrir novo documento)
     */
    private immediateCleanup(): void {
        console.log('⚡ [DocumentViewerService] Limpeza imediata');
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
