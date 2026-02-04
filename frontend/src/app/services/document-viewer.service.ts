import { Injectable, NgZone } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BehaviorSubject, Subject } from 'rxjs';

/**
 * Configuração baseada no dispositivo
 */
interface ViewerConfig {
    cleanupDelayMs: number;
    mobileDetected: boolean;
    /** Delay antes de carregar novo documento (ms) - maior em mobile */
    preOpenDelayMs: number;
    /** Delay após setar about:blank antes de remover iframe (ms) */
    blankNavigationDelayMs: number;
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
    /** Flag interno para saber se está em processo de limpeza */
    isDestroying: boolean;
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
        documentTitle: '',
        isDestroying: false
    });

    // Observable para componentes assinarem
    public state$ = this.stateSubject.asObservable();

    // Evento de limpeza forçada (para casos críticos de memória)
    private forceCleanupSubject = new Subject<void>();
    public forceCleanup$ = this.forceCleanupSubject.asObservable();

    // Configuração dinâmica baseada no dispositivo
    private config: ViewerConfig = {
        cleanupDelayMs: 150,
        mobileDetected: false,
        preOpenDelayMs: 100,
        blankNavigationDelayMs: 200
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

            // Móveis têm delays MUITO maiores para garbage collection
            if (this.config.mobileDetected) {
                this.config.cleanupDelayMs = 400; // Dobrado para dar tempo ao GC
                this.config.preOpenDelayMs = 300; // Aguardar mais antes de abrir novo
                this.config.blankNavigationDelayMs = 500; // Tempo CRÍTICO para about:blank ser processado
                console.log('📱 [DocumentViewerService] Modo mobile ativado - delays aumentados para preservar memória');
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

        // CRÍTICO MOBILE: Se estiver em processo de limpeza, aguardar
        if (this.isCleaningUp || this.currentState.isDestroying) {
            console.log('⏳ [DocumentViewerService] Aguardando limpeza anterior terminar...');
            // Aguardar até a flag ser liberada (com timeout de segurança)
            let waitCount = 0;
            const maxWait = 20; // Máximo 2 segundos (20 x 100ms)
            while ((this.isCleaningUp || this.currentState.isDestroying) && waitCount < maxWait) {
                await this.delay(100);
                waitCount++;
            }
            if (waitCount >= maxWait) {
                console.warn('⚠️ [DocumentViewerService] Timeout esperando limpeza - forçando reset');
                this.isCleaningUp = false;
                this.updateState({ isDestroying: false });
            }
        }

        // CRÍTICO: Se já houver um documento aberto, destruir completamente primeiro
        if (this.isDocumentOpen || this.currentState.viewerUrl) {
            console.log('🧹 [DocumentViewerService] Limpando documento anterior antes de abrir novo...');
            await this.destroyCurrentViewer();
            
            // MOBILE: Delay adicional APÓS destruição para garantir que memória foi liberada
            if (this.config.mobileDetected) {
                console.log('📱 [DocumentViewerService] Delay adicional pós-destruição para mobile...');
                await this.delay(this.config.preOpenDelayMs);
            }
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
            documentTitle: title,
            isDestroying: false
        });

        // MOBILE: Delay maior antes de carregar o iframe para dar tempo ao DOM
        await this.delay(this.config.mobileDetected ? 100 : 50);

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
        
        // Marcar como em destruição para evitar novas aberturas durante o processo
        this.updateState({ isDestroying: true });
        
        await this.destroyCurrentViewer();
        
        // MOBILE: Delay extra após fechar para garantir que GC tenha tempo de rodar
        if (this.config.mobileDetected) {
            await this.delay(200);
        }
        
        console.log('✅ [DocumentViewerService] Viewer fechado e memória liberada');
    }

    /**
     * CRÍTICO: Destrói o viewer atual completamente para liberar memória.
     * 
     * FLUXO DE DESTRUIÇÃO (especialmente importante para MOBILE):
     * 1. Marcar que está em processo de destruição
     * 2. Navegar iframe para about:blank (LIBERA recursos do Google Drive)
     * 3. AGUARDAR o navegador processar about:blank (CRÍTICO!)
     * 4. Somente após isso, setar URL para null (remove iframe do DOM)
     * 5. Aguardar ciclo de garbage collection
     * 6. Fechar modal e limpar flags
     */
    private async destroyCurrentViewer(): Promise<void> {
        // Se já está limpando, aguarda em vez de sair
        if (this.isCleaningUp) {
            console.warn('⚠️ [DocumentViewerService] Limpeza já em andamento, aguardando...');
            let waitCount = 0;
            while (this.isCleaningUp && waitCount < 20) {
                await this.delay(100);
                waitCount++;
            }
            return;
        }

        this.isCleaningUp = true;
        const previousDocId = this.currentState.currentDocumentId;

        console.log(`🧹 [DocumentViewerService] Iniciando destruição do documento: ${previousDocId}`);

        try {
            // PASSO 1: Marcar estado de destruição
            this.updateState({ 
                isDestroying: true,
                isLoading: false 
            });

            // PASSO 2: CRÍTICO - Navegar para about:blank ANTES de remover
            // Isso faz o navegador LIBERAR os recursos do Google Drive viewer
            if (this.currentState.viewerUrl) {
                console.log('🔄 [DocumentViewerService] Navegando para about:blank...');
                this.updateState({
                    viewerUrl: this.sanitizer.bypassSecurityTrustResourceUrl(this.BLANK_URL)
                });

                // PASSO 3: AGUARDAR o navegador processar about:blank
                // Este delay é CRÍTICO para mobile - o iframe precisa de tempo para:
                // - Cancelar requisições pendentes do Google Drive
                // - Liberar buffers de vídeo/PDF
                // - Descarregar scripts do iframe
                console.log(`⏳ [DocumentViewerService] Aguardando ${this.config.blankNavigationDelayMs}ms para about:blank ser processado...`);
                await this.delay(this.config.blankNavigationDelayMs);
            }

            // PASSO 4: Agora sim, remover iframe do DOM (URL = null)
            console.log('🗑️ [DocumentViewerService] Removendo iframe do DOM...');
            this.updateState({
                viewerUrl: null,
                currentDocumentId: null,
                documentTitle: ''
            });

            // PASSO 5: Aguardar mais um ciclo para remoção do DOM e GC
            await this.delay(this.config.cleanupDelayMs);

            // PASSO 6: Fechar modal
            this.updateState({ 
                isVisible: false,
                isDestroying: false
            });

            console.log(`✅ [DocumentViewerService] Documento ${previousDocId} destruído completamente`);

        } catch (error) {
            console.error('❌ [DocumentViewerService] Erro durante destruição:', error);
            // Em caso de erro, garantir que estado está limpo
            this.updateState({
                isVisible: false,
                isLoading: false,
                viewerUrl: null,
                currentDocumentId: null,
                documentTitle: '',
                isDestroying: false
            });
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
    getDebugStats(): { viewCount: number; viewHistory: string[]; isMobile: boolean; config: ViewerConfig } {
        return {
            viewCount: this.viewCount,
            viewHistory: [...this.viewHistory],
            isMobile: this.config.mobileDetected,
            config: { ...this.config }
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
        this.updateState({
            isVisible: false,
            isLoading: false,
            viewerUrl: null,
            currentDocumentId: null,
            documentTitle: '',
            isDestroying: false
        });
        console.log('✅ [DocumentViewerService] Reset concluído');
    }
}
