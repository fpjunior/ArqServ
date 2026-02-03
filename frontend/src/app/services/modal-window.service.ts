import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Estado da janela do modal
 */
export interface WindowState {
    x: number;
    y: number;
    width: number;
    height: number;
    isMaximized: boolean;
}

/**
 * Serviço para gerenciar estado e comportamento de janela do modal
 * Funciona apenas no desktop - mobile mantém comportamento padrão fullscreen
 */
@Injectable({
    providedIn: 'root'
})
export class ModalWindowService {
    private readonly MIN_WIDTH = 400;
    private readonly MIN_HEIGHT = 300;

    private isMobile = false;

    // Estado padrão centralizado (Ajustado para formato documento/retrato)
    private defaultState: WindowState = {
        x: 0,
        y: 0,
        width: 700,
        height: 800,
        isMaximized: false
    };

    private stateSubject = new BehaviorSubject<WindowState>(this.defaultState);
    public state$ = this.stateSubject.asObservable();

    // Estado de drag (Var sulfixo para diferenciar do getter público)
    private isDraggingVar = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private windowStartX = 0;
    private windowStartY = 0;

    // Estado de resize
    private isResizingVar = false;
    private resizeEdge = '';
    private resizeStartX = 0;
    private resizeStartY = 0;
    private resizeStartWidth = 0;
    private resizeStartHeight = 0;
    private resizeStartWindowX = 0;
    private resizeStartWindowY = 0;

    // Estado antes de maximizar (em memória)
    private preMaximizeState: WindowState | null = null;

    // Gets públicos para o template usar overlay no iframe e status
    get isDragging(): boolean { return this.isDraggingVar; }
    get isResizing(): boolean { return this.isResizingVar; }
    get isInteracting(): boolean { return this.isDraggingVar || this.isResizingVar; }

    constructor() {
        this.detectMobile();
        this.resetToDefault();
        this.setupEventListeners();
    }

    private detectMobile(): void {
        if (typeof window !== 'undefined') {
            this.isMobile = window.innerWidth < 768 ||
                /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());
        }
    }

    get isMobileDevice(): boolean {
        return this.isMobile;
    }

    get currentState(): WindowState {
        return this.stateSubject.getValue();
    }

    resetToDefault(): void {
        this.stateSubject.next({ ...this.defaultState });
        this.centerWindow();
    }

    centerWindow(): void {
        if (typeof window === 'undefined') return;

        const state = this.currentState;
        // Se estiver maximizado, usa dimensões padrão para cálculo
        const width = this.defaultState.width;
        const height = this.defaultState.height;

        // Garante que não ultrapasse a tela inicialmente (com margem)
        const safeWidth = Math.min(width, window.innerWidth - 40);
        const safeHeight = Math.min(height, window.innerHeight - 40);

        const x = Math.max(0, (window.innerWidth - safeWidth) / 2);
        const y = Math.max(0, (window.innerHeight - safeHeight) / 2);

        this.updateState({ x, y, width: safeWidth, height: safeHeight, isMaximized: false });
    }

    private updateState(partial: Partial<WindowState>): void {
        const newState = { ...this.currentState, ...partial };
        this.stateSubject.next(newState);
    }

    // ========== DRAG (Arrastar) ==========

    startDrag(event: MouseEvent): void {
        if (this.isMobile || this.currentState.isMaximized) return;

        event.preventDefault();
        this.isDraggingVar = true;
        this.dragStartX = event.clientX;
        this.dragStartY = event.clientY;
        this.windowStartX = this.currentState.x;
        this.windowStartY = this.currentState.y;

        document.body.style.cursor = 'move';
        document.body.style.userSelect = 'none';
    }

    private onMouseMove = (event: MouseEvent): void => {
        if (this.isDraggingVar) {
            const deltaX = event.clientX - this.dragStartX;
            const deltaY = event.clientY - this.dragStartY;

            let newX = this.windowStartX + deltaX;
            let newY = this.windowStartY + deltaY;

            // Limitar dentro da tela
            const maxX = window.innerWidth - this.currentState.width;
            const maxY = window.innerHeight - this.currentState.height;

            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            this.updateState({ x: newX, y: newY });
        }

        if (this.isResizingVar) {
            this.handleResize(event);
        }
    };

    private onMouseUp = (): void => {
        this.isDraggingVar = false;
        this.isResizingVar = false;
        this.resizeEdge = '';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };

    // ========== RESIZE (Redimensionar) ==========

    startResize(event: MouseEvent, edge: string): void {
        if (this.isMobile || this.currentState.isMaximized) return;

        event.preventDefault();
        event.stopPropagation();

        this.isResizingVar = true;
        this.resizeEdge = edge;
        this.resizeStartX = event.clientX;
        this.resizeStartY = event.clientY;
        this.resizeStartWidth = this.currentState.width;
        this.resizeStartHeight = this.currentState.height;
        this.resizeStartWindowX = this.currentState.x;
        this.resizeStartWindowY = this.currentState.y;

        document.body.style.userSelect = 'none';

        // Define cursor body for better UX during resize
        document.body.style.cursor = this.getResizeCursor(edge);
    }

    private handleResize(event: MouseEvent): void {
        const deltaX = event.clientX - this.resizeStartX;
        const deltaY = event.clientY - this.resizeStartY;

        let newWidth = this.resizeStartWidth;
        let newHeight = this.resizeStartHeight;
        let newX = this.resizeStartWindowX;
        let newY = this.resizeStartWindowY;

        // Ajustar baseado na borda sendo redimensionada
        if (this.resizeEdge.includes('e')) {
            newWidth = Math.max(this.MIN_WIDTH, this.resizeStartWidth + deltaX);
        }
        if (this.resizeEdge.includes('w')) {
            const proposedWidth = this.resizeStartWidth - deltaX;
            if (proposedWidth >= this.MIN_WIDTH) {
                newWidth = proposedWidth;
                newX = this.resizeStartWindowX + deltaX;
            } else {
                // Se atingir min width, não move X mais do que o necessário
                // Opcional: Travar
            }
        }
        if (this.resizeEdge.includes('s')) {
            newHeight = Math.max(this.MIN_HEIGHT, this.resizeStartHeight + deltaY);
        }
        if (this.resizeEdge.includes('n')) {
            const proposedHeight = this.resizeStartHeight - deltaY;
            if (proposedHeight >= this.MIN_HEIGHT) {
                newHeight = proposedHeight;
                newY = this.resizeStartWindowY + deltaY;
            }
        }

        // Limitar para não sair da tela
        if (newX < 0) newX = 0;
        if (newY < 0) newY = 0;
        if (newX + newWidth > window.innerWidth) newWidth = window.innerWidth - newX;
        if (newY + newHeight > window.innerHeight) newHeight = window.innerHeight - newY;

        this.updateState({ width: newWidth, height: newHeight, x: newX, y: newY });
    }

    // ========== MAXIMIZE ==========

    toggleMaximize(): void {
        if (this.isMobile) return;

        const isMaximized = !this.currentState.isMaximized;

        if (isMaximized) {
            // Salvar estado atual antes de maximizar
            this.preMaximizeState = { ...this.currentState };

            this.updateState({
                x: 0,
                y: 0,
                width: window.innerWidth,
                height: window.innerHeight,
                isMaximized: true
            });
        } else {
            // Restaurar para estado anterior armazenado
            if (this.preMaximizeState) {
                this.updateState({
                    ...this.preMaximizeState,
                    isMaximized: false
                });
            } else {
                // Fallback para default
                this.resetToDefault();
            }
        }
    }

    // ========== EVENT LISTENERS ==========

    private setupEventListeners(): void {
        if (typeof document !== 'undefined') {
            document.addEventListener('mousemove', this.onMouseMove);
            document.addEventListener('mouseup', this.onMouseUp);
        }
    }

    destroy(): void {
        if (typeof document !== 'undefined') {
            document.removeEventListener('mousemove', this.onMouseMove);
            document.removeEventListener('mouseup', this.onMouseUp);
        }
    }

    /**
     * Retorna o estilo CSS para a janela
     */
    getWindowStyle(): { [key: string]: string } {
        if (this.isMobile) {
            return {
                position: 'fixed',
                inset: '0',
                width: '100%',
                height: '100%'
            };
        }

        const state = this.currentState;

        if (state.isMaximized) {
            return {
                position: 'fixed',
                left: '0',
                top: '0',
                width: '100vw',
                height: '100vh'
            };
        }

        return {
            position: 'fixed',
            left: `${state.x}px`,
            top: `${state.y}px`,
            width: `${state.width}px`,
            height: `${state.height}px`
        };
    }

    /**
     * Retorna o cursor apropriado para cada borda
     */
    getResizeCursor(edge: string): string {
        const cursors: { [key: string]: string } = {
            'n': 'ns-resize',
            's': 'ns-resize',
            'e': 'ew-resize',
            'w': 'ew-resize',
            'ne': 'nesw-resize',
            'nw': 'nwse-resize',
            'se': 'nwse-resize',
            'sw': 'nesw-resize'
        };
        return cursors[edge] || 'default';
    }
}
