import { Injectable, NgZone } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BehaviorSubject, Subject } from 'rxjs';

/**
 * Configuração baseada no dispositivo
 */
interface ViewerConfig {
    cleanupDelayMs: number;
    mobileDetected: boolean;
}

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
 * PROBLEMAS RESOLVIDOS:
 * - Vazamento de memória em dispositivos móveis ao abrir múltiplos documentos
 * - Destruição incompleta de iframes do Google Drive
 * - Falta de controle de limite de visualizações
 * 
 * Este serviço deve ser usado por TODOS os componentes que exibem documentos.
 */
@Injectable({
    providedIn: 'root'
})
export class DocumentViewerService {
    private readonly BLANK_URL = 'about:blank';

    // Contador de visualizações na sessão (apenas para estatísticas)
    private viewCount = 0;

    // Flag para prevenir operações concorrentes de limpeza
    private isCleaningUp = false;

    // Histórico de IDs de documentos visualizados para debug
    private viewHistory: string[] = [];

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

    // Evento de limpeza forçada (para casos críticos de memória)
    private forceCleanupSubject = new Subject<void>();
    public forceCleanup$ = this.forceCleanupSubject.asObservable();

    // Configuração dinâmica baseada no dispositivo
    private config: ViewerConfig = {
        cleanupDelayMs: 150,
        mobileDetected: false
    };

    constructor(
        private sanitizer: DomSanitizer,
        private ngZone: NgZone
    ) {
        this.detectMobileDevice();
        console.log('📱 [DocumentViewerService] Inicializado. Mobile:', this.config.mobileDetected);
    }

    /**
     * Detecta se está em dispositivo móvel para ajustar delays de limpeza
     */
    private detectMobileDevice(): void {
        if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
            const userAgent = navigator.userAgent.toLowerCase();
            this.config.mobileDetected = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

            // Móveis têm delays maiores para garbage collection
            if (this.config.mobileDetected) {
                this.config.cleanupDelayMs = 250; // Mais tempo para GC em dispositivos lentos
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
        return this.currentState.isVisible && this.currentState.viewerUrl !== null;
    }

    /**
     * Abre um documento no modal de forma segura.
     * IMPORTANTE: Sempre limpa o documento anterior antes de abrir o novo.
     * 
     * @param documentId ID do documento (drive_file_id ou google_drive_id)
     * @param title Título do documento para exibição
     * @param customUrl URL customizada (opcional, para casos especiais)
     * @returns Promise que resolve quando o documento estiver pronto para exibição
     */
    async openDocument(documentId: string, title: string, customUrl?: string): Promise<boolean> {
        console.log(`📖 [DocumentViewerService] Abrindo documento: ${title} (${documentId})`);

        // CRÍTICO: Se já houver um documento aberto, destruir completamente primeiro
        if (this.isDocumentOpen || this.currentState.viewerUrl) {
            console.log('🧹 [DocumentViewerService] Limpando documento anterior antes de abrir novo...');
            await this.destroyCurrentViewer();
        }

        // Incrementar contador para estatísticas (sem limitação)
        this.viewCount++;
        this.viewHistory.push(documentId);

        // Limitar histórico para não consumir memória infinitamente
        if (this.viewHistory.length > 100) {
            this.viewHistory = this.viewHistory.slice(-50);
        }

        // Preparar URL do viewer
        let viewerUrl: SafeResourceUrl;
        if (customUrl) {
            viewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(customUrl);
        } else {
            const embedUrl = `https://drive.google.com/file/d/${documentId}/preview`;
            viewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
        }

        // Atualizar estado para mostrar loading
        this.updateState({
            isVisible: true,
            isLoading: true,
            viewerUrl: null,
            currentDocumentId: documentId,
            documentTitle: title
        });

        // Pequeno delay para garantir que o DOM está pronto
        await this.delay(50);

        // Definir URL do viewer
        this.updateState({
            viewerUrl: viewerUrl
        });

        console.log(`✅ [DocumentViewerService] Documento carregado: ${title}`);
        return true;
    }

    /**
     * Notifica que o iframe terminou de carregar
     */
    onIframeLoaded(): void {
        this.updateState({ isLoading: false });
        console.log('✅ [DocumentViewerService] Iframe carregado');
    }

    /**
     * Fecha o modal e destrói o iframe completamente.
     * Este método deve SEMPRE ser chamado ao fechar o modal.
     * 
     * @returns Promise que resolve quando a limpeza estiver completa
     */
    async closeViewer(): Promise<void> {
        console.log('🔒 [DocumentViewerService] Fechando viewer e liberando memória...');
        await this.destroyCurrentViewer();
    }

    /**
     * CRÍTICO: Destrói o viewer atual completamente para liberar memória.
     * 
     * Passos:
     * 1. Substituir URL por about:blank (libera recursos do Drive)
     * 2. Aguardar navegador processar (crítico para mobile)
     * 3. Remover URL completamente
     * 4. Aguardar garbage collection
     */
    private async destroyCurrentViewer(): Promise<void> {
        if (this.isCleaningUp) {
            console.warn('⚠️ [DocumentViewerService] Limpeza já em andamento, aguardando...');
            await this.delay(this.config.cleanupDelayMs * 2);
            return;
        }

        this.isCleaningUp = true;
        const previousDocId = this.currentState.currentDocumentId;

        try {
            // PASSO 1: Substituir URL por about:blank
            this.updateState({
                viewerUrl: this.sanitizer.bypassSecurityTrustResourceUrl(this.BLANK_URL),
                isLoading: false
            });

            // PASSO 2: Aguardar navegador processar about:blank
            await this.delay(100);

            // PASSO 3: Remover iframe do DOM (URL = null)
            this.updateState({
                viewerUrl: null,
                currentDocumentId: null,
                documentTitle: ''
            });

            // PASSO 4: Aguardar mais um ciclo para remoção do DOM
            await this.delay(this.config.cleanupDelayMs);

            // PASSO 5: Fechar modal
            this.updateState({ isVisible: false });

            console.log(`✅ [DocumentViewerService] Documento ${previousDocId} destruído completamente`);

        } finally {
            this.isCleaningUp = false;
        }
    }

    /**
     * Limpeza de emergência quando muitos documentos foram visualizados.
     * Força garbage collection do navegador.
     */
    private async performEmergencyCleanup(): Promise<void> {
        console.log('🚨 [DocumentViewerService] Executando limpeza de emergência...');

        // Notificar componentes sobre limpeza forçada
        this.forceCleanupSubject.next();

        // Resetar contador
        this.viewCount = 0;
        this.viewHistory = [];

        // Forçar garbage collection (onde disponível)
        if (typeof window !== 'undefined' && (window as any).gc) {
            (window as any).gc();
            console.log('🗑️ [DocumentViewerService] Garbage collection forçado');
        }

        // Delay adicional para mobile
        if (this.config.mobileDetected) {
            await this.delay(500);
        }

        console.log('✅ [DocumentViewerService] Limpeza de emergência concluída');
    }

    /**
     * Atualiza estado parcialmente
     */
    private updateState(partialState: Partial<ViewerState>): void {
        // Executar dentro da NgZone para garantir detecção de mudanças
        this.ngZone.run(() => {
            const current = this.stateSubject.getValue();
            this.stateSubject.next({ ...current, ...partialState });
        });
    }

    /**
     * Utilitário para delay assíncrono
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Obtém estatísticas para debug
     */
    getDebugStats(): { viewCount: number; viewHistory: string[]; isMobile: boolean } {
        return {
            viewCount: this.viewCount,
            viewHistory: [...this.viewHistory],
            isMobile: this.config.mobileDetected
        };
    }

    /**
     * Força reset completo do serviço (para casos críticos)
     */
    async forceReset(): Promise<void> {
        console.log('🔄 [DocumentViewerService] Reset forçado iniciado...');
        await this.destroyCurrentViewer();
        this.viewCount = 0;
        this.viewHistory = [];
        this.isCleaningUp = false;
        console.log('✅ [DocumentViewerService] Reset concluído');
    }
}
