import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatChipsModule } from '@angular/material/chips';

import { AuthService, User } from '../../../../shared/services/auth.service';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatCardModule,
    MatGridListModule,
    MatChipsModule
  ],
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {
  currentUser: User | null = null;

  // Dados simulados para demonstração
  stats = {
    totalDocuments: 1247,
    totalServers: 89,
    recentUploads: 23,
    pendingReviews: 7
  };

  recentDocuments = [
    {
      id: '1',
      fileName: 'CPF_Ana_Maria.pdf',
      serverName: 'Ana Maria',
      uploadDate: new Date(2024, 10, 5),
      size: '1.2 MB',
      type: 'CPF'
    },
    {
      id: '2',
      fileName: 'Comprovante_Residencia_Joao.pdf',
      serverName: 'João Silva',
      uploadDate: new Date(2024, 10, 4),
      size: '856 KB',
      type: 'Comprovante'
    },
    {
      id: '3',
      fileName: 'Certidao_Nascimento_Maria.pdf',
      serverName: 'Maria Santos',
      uploadDate: new Date(2024, 10, 3),
      size: '2.1 MB',
      type: 'Certidão'
    }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  navigateToDocuments(): void {
    // Implementar navegação para lista de documentos
    console.log('Navegar para documentos');
  }

  navigateToServers(): void {
    // Implementar navegação para lista de servidores
    console.log('Navegar para servidores');
  }

  navigateToUpload(): void {
    // Implementar navegação para upload
    console.log('Navegar para upload');
  }

  viewDocument(documentId: string): void {
    // Implementar visualização de documento
    console.log('Visualizar documento:', documentId);
  }

  downloadDocument(documentId: string): void {
    // Implementar download de documento
    console.log('Baixar documento:', documentId);
  }

  formatFileSize(bytes: string): string {
    return bytes; // Por enquanto retorna como está
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR');
  }
}