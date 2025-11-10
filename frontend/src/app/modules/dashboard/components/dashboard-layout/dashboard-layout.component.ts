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
      if (!this.currentUser) {
        this.router.navigate(['/auth/login']);
      }
    });
    
    this.currentRoute = this.router.url;
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

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  isActiveRoute(route: string): boolean {
    return this.currentRoute === route;
  }

  navigateToUpload(): void {
    console.log('Navegando para upload de documentos');
    // TODO: Implementar navegação para upload
  }

  getPageTitle(): string {
    switch (this.currentRoute) {
      case '/dashboard':
        return 'Bem-vindo ao ArqServ';
      case '/servers':
        return 'Gerenciar Servidores';
      default:
        return 'ArqServ';
    }
  }

  getPageSubtitle(): string {
    switch (this.currentRoute) {
      case '/dashboard':
        return 'Gestão Compartilhada de Arquivos';
      case '/servers':
        return 'Organize servidores por grupos alfabéticos';
      default:
        return 'Sistema de Gestão';
    }
  }
}