import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { AuthService, User } from '../../../../shared/services/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './dashboard-layout.component.html',
  styleUrls: ['./dashboard-layout.component.scss']
})
export class DashboardLayoutComponent implements OnInit {
  currentUser: User | null = null;
  currentRoute: string = '';
  showLogoutModal: boolean = false;

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
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      console.log('👤 [DASHBOARD] Current user:', this.currentUser);
      if (!this.currentUser) {
        this.router.navigate(['/auth/login']);
      }
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
    
    switch (this.currentUser.user_type) {
      case 'admin':
        return 'Administrador - ArqServ';
      case 'prefeitura':
        return `Prefeitura - ${this.currentUser.municipality || 'N/A'}`;
      default:
        return this.currentUser.role === 'admin' ? 'Administrador' : this.currentUser.municipality || this.currentUser.role || 'Usuário';
    }
  }
}