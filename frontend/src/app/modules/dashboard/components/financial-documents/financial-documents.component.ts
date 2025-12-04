import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';

interface FinancialFolder {
  id: string;
  name: string;
  icon: string;
  description: string;
  count: number;
  color: string;
}

@Component({
  selector: 'app-financial-documents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './financial-documents.component.html',
  styleUrls: ['./financial-documents.component.scss']
})
export class FinancialDocumentsComponent implements OnInit {
  financialFolders: FinancialFolder[] = [
    {
      id: 'licitacoes',
      name: 'Licitações',
      icon: '📋',
      description: 'Documentos de processos licitatórios',
      count: 24,
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'despesas',
      name: 'Despesas',
      icon: '💸',
      description: 'Registros de gastos e despesas',
      count: 156,
      color: 'from-red-500 to-red-600'
    },
    {
      id: 'receitas',
      name: 'Receitas',
      icon: '💰',
      description: 'Documentos de receitas e arrecadação',
      count: 89,
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'contratos',
      name: 'Contratos',
      icon: '📝',
      description: 'Contratos firmados e documentação',
      count: 43,
      color: 'from-purple-500 to-purple-600'
    }
  ];

  selectedFolder: FinancialFolder | null = null;
  municipalityCode: string | null = null;

  constructor(private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.municipalityCode = this.route.snapshot.paramMap.get('municipalityCode');
    console.log('Selected Municipality Code:', this.municipalityCode);
  }

  selectFolder(folder: FinancialFolder): void {
    this.selectedFolder = folder;
    console.log(`Pasta selecionada: ${folder.name}`);
    this.router.navigate(['/documentacoes-financeiras', folder.id]);
  }

  navigateBack(): void {
    this.router.navigate(['/dashboard']);
  }

  getTotalDocuments(): number {
    return this.financialFolders.reduce((total, folder) => total + folder.count, 0);
  }
}