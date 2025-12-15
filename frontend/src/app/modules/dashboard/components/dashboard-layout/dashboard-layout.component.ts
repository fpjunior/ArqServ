import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { AuthService, User } from '../../../../shared/services/auth.service';
import { filter } from 'rxjs/operators';

import { ChangePasswordModalComponent } from '../change-password-modal/change-password-modal.component';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ChangePasswordModalComponent],
  templateUrl: './dashboard-layout.component.html',
  styleUrls: ['./dashboard-layout.component.scss']
})
export class DashboardLayoutComponent implements OnInit {
  currentUser: User | null = null;
  currentRoute: string = '';
  showLogoutModal: boolean = false;
  showChangePasswordModal: boolean = false;
  isUserMenuOpen: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // Escutar mudanças de rota para atualizar a aba ativa
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute = event.urlAfterRedirects;
    });
  }

  ngOnInit(): void {
    // Carregar usuário do localStorage imediatamente para evitar delay
    const storedUser = localStorage.getItem('arqserv_user');
    if (storedUser) {
      try {
        this.currentUser = JSON.parse(storedUser);
        console.log('👤 [DASHBOARD] Usuário carregado do localStorage:', this.currentUser);
      } catch (e) {
        console.warn('⚠️ [DASHBOARD] Erro ao carregar usuário do localStorage');
      }
    }

    // Continuar observando mudanças do AuthService
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      console.log('👤 [DASHBOARD] Current user atualizado:', this.currentUser);
    });

    this.currentRoute = this.router.url;

    // Adicionar atalho de teclado para logout (Ctrl/Cmd + Shift + L)
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        console.log('🔑 Logout via atalho de teclado');
        this.forceLogout();
      }
    });
  }

  isAdmin(): boolean {
    // Verificar localmente primeiro para evitar delay
    return this.currentUser?.role === 'admin';
  }

  logout(): void {
    // Mostrar modal de confirmação
    this.showLogoutModal = true;
  }

  confirmLogout(): void {
    this.showLogoutModal = false;
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  cancelLogout(): void {
    this.showLogoutModal = false;
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }

  openChangePasswordModal(): void {
    this.isUserMenuOpen = false;
    this.showChangePasswordModal = true;
  }

  closeChangePasswordModal(): void {
    this.showChangePasswordModal = false;
  }

  forceLogout(): void {
    console.log('🚪 Force logout executado');
    this.showLogoutModal = false;
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  isActiveRoute(route: string): boolean {
    return this.currentRoute === route;
  }

  navigateToUpload(): void {
    console.log('Navegando para upload de documentos');
    this.router.navigate(['/upload']);
  }

  navigateToServers(): void {
    if (this.isAdmin()) {
      this.router.navigate(['/admin/municipalities']);
    } else {
      this.navigateTo('/servers');
    }
  }

  navigateToFinancialDocuments(): void {
    if (this.isAdmin()) {
      this.router.navigate(['/documentacoes-financeiras']);
    } else {
      this.navigateTo('/documentacoes-financeiras');
    }
  }

  getPageTitle(): string {
    if (this.currentRoute.startsWith('/documentacoes-financeiras/')) {
      const category = this.currentRoute.split('/')[2];
      const categoryNames: { [key: string]: string } = {
        'licitacoes': 'Licitações',
        'despesas': 'Despesas',
        'receitas': 'Receitas',
        'contratos': 'Contratos'
      };
      return categoryNames[category] || 'Documentações Financeiras';
    }

    switch (this.currentRoute) {
      case '/dashboard':
        return 'Bem-vindo ao ArqServ';
      case '/servers':
        return 'Gerenciar Servidores';
      case '/upload':
        return 'Upload de Documentos';
      case '/users':
        return 'Usuários';
      case '/users/new':
        return 'Cadastrar Usuário';
      case '/documentacoes-financeiras':
        return 'Documentações Financeiras';
      default:
        return 'ArqServ';
    }
  }

  getPageSubtitle(): string {
    if (this.currentRoute.startsWith('/documentacoes-financeiras/')) {
      const category = this.currentRoute.split('/')[2];
      const categoryDescriptions: { [key: string]: string } = {
        'licitacoes': 'Documentos de processos licitatórios',
        'despesas': 'Registros de gastos e despesas',
        'receitas': 'Documentos de receitas e arrecadação',
        'contratos': 'Contratos firmados e documentação'
      };
      return categoryDescriptions[category] || 'Gerencie documentos financeiros';
    }

    switch (this.currentRoute) {
      case '/dashboard':
        return 'Gestão Compartilhada de Arquivosadfsdfas';
      case '/servers':
        return 'Organize servidores por grupos alfabéticos';
      case '/upload':
        return 'Faça upload de documentos para o Google Drive';
      case '/users':
        return 'Gerencie usuários do sistema';
      case '/users/new':
        return 'Adicione novos usuários ao sistema';
      case '/documentacoes-financeiras':
        return 'Gerencie documentos financeiros e contábeis';
      default:
        return 'Sistema de Gestão';
    }
  }

  getUserTypeLabel(): string {
    if (!this.currentUser) return '';

    // Retorna label baseado no role
    switch (this.currentUser.role) {
      case 'admin':
        return 'Administrador - ArqServ';
      case 'manager':
        return 'Gerenciador';
      case 'user':
        return 'Usuário';
      default:
        return this.currentUser.role || 'Usuário';
    }
  }
}