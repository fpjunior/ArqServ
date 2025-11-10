import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, User } from '../../../../shared/services/auth.service';

interface Document {
  id: string;
  fileName: string;
  serverName: string;
  type: string;
  size: string;
  uploadDate: Date;
}

interface Stats {
  totalDocuments: number;
  totalServers: number;
  recentUploads: number;
  pendingReviews: number;
}

@Component({
  selector: 'app-main-simple',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './main-simple.component.html',
  styleUrls: ['./main-simple.component.scss']
})
export class MainSimpleComponent implements OnInit {
  currentUser: User | null = null;
  searchTerm: string = '';
  
  stats: Stats = {
    totalDocuments: 0,
    totalServers: 0,
    recentUploads: 0,
    pendingReviews: 0
  };

  recentDocuments: Document[] = [];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUserData();
    this.loadStats();
    this.loadRecentDocuments();
  }

  private loadUserData(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (!this.currentUser) {
        this.router.navigate(['/auth/login']);
      } else {
        this.loadStats(); // Recarregar stats quando usuário mudar
      }
    });
  }

  private loadStats(): void {
    // Simular dados baseados no role do usuário
    if (this.currentUser?.role === 'empresa') {
      this.stats = {
        totalDocuments: 15743,
        totalServers: 824,
        recentUploads: 127,
        pendingReviews: 23
      };
    } else {
      // Para prefeitura - dados mais limitados
      this.stats = {
        totalDocuments: 2456,
        totalServers: 54,
        recentUploads: 45,
        pendingReviews: 8
      };
    }
  }

  private loadRecentDocuments(): void {
    // Simular documentos recentes
    this.recentDocuments = [
      {
        id: '1',
        fileName: 'Certidao_Nascimento_001.pdf',
        serverName: 'João Silva',
        type: 'PDF',
        size: '2.3 MB',
        uploadDate: new Date(2024, 0, 15)
      },
      {
        id: '2',
        fileName: 'RG_Frente_002.jpg',
        serverName: 'Maria Santos',
        type: 'JPG',
        size: '1.8 MB',
        uploadDate: new Date(2024, 0, 14)
      },
      {
        id: '3',
        fileName: 'CPF_003.pdf',
        serverName: 'Pedro Oliveira',
        type: 'PDF',
        size: '890 KB',
        uploadDate: new Date(2024, 0, 13)
      },
      {
        id: '4',
        fileName: 'Comprovante_Residencia_004.pdf',
        serverName: 'Ana Costa',
        type: 'PDF',
        size: '1.2 MB',
        uploadDate: new Date(2024, 0, 12)
      },
      {
        id: '5',
        fileName: 'Titulo_Eleitor_005.jpg',
        serverName: 'Carlos Mendes',
        type: 'JPG',
        size: '2.1 MB',
        uploadDate: new Date(2024, 0, 11)
      }
    ];
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  navigateToServers(): void {
    this.router.navigate(['/servers']);
  }

  navigateToUpload(): void {
    console.log('Navegando para upload de documentos');
    // TODO: Implementar navegação para upload
  }

  navigateToReports(): void {
    console.log('Navegando para relatórios');
    // TODO: Implementar navegação para relatórios
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  isActiveRoute(route: string): boolean {
    return this.router.url === route;
  }

  onSearch(): void {
    console.log('Buscando por:', this.searchTerm);
    // TODO: Implementar funcionalidade de busca
  }

  viewDocument(documentId: string): void {
    console.log('Visualizando documento:', documentId);
    // TODO: Implementar visualização de documento
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }
}