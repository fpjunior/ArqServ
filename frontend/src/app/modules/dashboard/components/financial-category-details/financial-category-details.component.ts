import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

interface FinancialDocument {
  id: number;
  name: string;
  type: string;
  uploadDate: Date;
  size: string;
  status: 'active' | 'archived' | 'pending';
  description?: string;
  tags?: string[];
  googleDriveId?: string;
  googleDriveUrl?: string;
}

interface FinancialCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

@Component({
  selector: 'app-financial-category-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './financial-category-details.component.html',
  styleUrls: ['./financial-category-details.component.scss']
})
export class FinancialCategoryDetailsComponent implements OnInit {
  categoryId: string = '';
  category: FinancialCategory | null = null;
  documents: FinancialDocument[] = [];
  filteredDocuments: FinancialDocument[] = [];
  searchTerm: string = '';
  selectedStatus: string = 'all';
  isLoading: boolean = true;

  // Definição das categorias
  categories: { [key: string]: FinancialCategory } = {
    'licitacoes': {
      id: 'licitacoes',
      name: 'Licitações',
      icon: '📋',
      description: 'Documentos de processos licitatórios',
      color: 'from-blue-500 to-blue-600'
    },
    'despesas': {
      id: 'despesas',
      name: 'Despesas',
      icon: '💸',
      description: 'Registros de gastos e despesas',
      color: 'from-red-500 to-red-600'
    },
    'receitas': {
      id: 'receitas',
      name: 'Receitas',
      icon: '💰',
      description: 'Documentos de receitas e arrecadação',
      color: 'from-green-500 to-green-600'
    },
    'contratos': {
      id: 'contratos',
      name: 'Contratos',
      icon: '📝',
      description: 'Contratos firmados e documentação',
      color: 'from-purple-500 to-purple-600'
    }
  };

  // Documentos mockados para demonstração
  mockDocuments: FinancialDocument[] = [
    {
      id: 1,
      name: 'Edital de Licitação 001/2024',
      type: 'PDF',
      uploadDate: new Date('2024-11-15'),
      size: '2.3 MB',
      status: 'active',
      description: 'Edital para contratação de serviços de limpeza',
      tags: ['edital', 'limpeza', '2024'],
      googleDriveUrl: 'https://drive.google.com/file/d/example1'
    },
    {
      id: 2,
      name: 'Ata de Registro de Preços 002/2024',
      type: 'PDF',
      uploadDate: new Date('2024-11-10'),
      size: '1.8 MB',
      status: 'active',
      description: 'Ata de registro de preços para materiais de escritório',
      tags: ['ata', 'precos', 'materiais'],
      googleDriveUrl: 'https://drive.google.com/file/d/example2'
    },
    {
      id: 3,
      name: 'Folha de Pagamento - Outubro/2024',
      type: 'XLSX',
      uploadDate: new Date('2024-11-01'),
      size: '856 KB',
      status: 'active',
      description: 'Folha de pagamento dos servidores - outubro',
      tags: ['folha', 'pagamento', 'outubro'],
      googleDriveUrl: 'https://drive.google.com/file/d/example3'
    },
    {
      id: 4,
      name: 'Relatório de Receitas - 3º Trimestre',
      type: 'PDF',
      uploadDate: new Date('2024-10-30'),
      size: '3.2 MB',
      status: 'active',
      description: 'Relatório consolidado de receitas do terceiro trimestre',
      tags: ['receitas', 'trimestre', 'relatorio'],
      googleDriveUrl: 'https://drive.google.com/file/d/example4'
    },
    {
      id: 5,
      name: 'Contrato de Prestação de Serviços 15/2024',
      type: 'PDF',
      uploadDate: new Date('2024-10-25'),
      size: '1.2 MB',
      status: 'pending',
      description: 'Contrato para serviços de manutenção predial',
      tags: ['contrato', 'manutencao', 'predial'],
      googleDriveUrl: 'https://drive.google.com/file/d/example5'
    }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.categoryId = params['category'];
      this.loadCategoryData();
    });
  }

  loadCategoryData(): void {
    this.isLoading = true;
    
    // Carregar dados da categoria
    this.category = this.categories[this.categoryId];
    
    if (!this.category) {
      this.router.navigate(['/documentacoes-financeiras']);
      return;
    }

    // Simular carregamento de documentos
    setTimeout(() => {
      this.documents = this.mockDocuments.filter(doc => 
        this.getDocumentCategory(doc.name) === this.categoryId
      );
      this.filteredDocuments = [...this.documents];
      this.isLoading = false;
    }, 500);
  }

  private getDocumentCategory(documentName: string): string {
    const name = documentName.toLowerCase();
    if (name.includes('edital') || name.includes('licitação') || name.includes('ata')) {
      return 'licitacoes';
    } else if (name.includes('folha') || name.includes('pagamento') || name.includes('despesa')) {
      return 'despesas';
    } else if (name.includes('receita') || name.includes('arrecadação')) {
      return 'receitas';
    } else if (name.includes('contrato')) {
      return 'contratos';
    }
    return this.categoryId; // fallback para a categoria atual
  }

  filterDocuments(): void {
    this.filteredDocuments = this.documents.filter(doc => {
      const matchesSearch = !this.searchTerm || 
        doc.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        doc.description?.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesStatus = this.selectedStatus === 'all' || doc.status === this.selectedStatus;
      
      return matchesSearch && matchesStatus;
    });
  }

  onSearchChange(event: any): void {
    this.searchTerm = event.target.value;
    this.filterDocuments();
  }

  onStatusChange(event: any): void {
    this.selectedStatus = event.target.value;
    this.filterDocuments();
  }

  downloadDocument(doc: FinancialDocument): void {
    console.log(`⬇️ Fazendo download do documento: ${doc.name}`);
    if (doc.googleDriveUrl) {
      // Implementar download direto em vez de abrir nova guia
      const link = window.document.createElement('a');
      link.href = doc.googleDriveUrl;
      link.download = doc.name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    } else {
      alert('URL do documento não encontrada');
    }
  }

  viewDocument(doc: FinancialDocument): void {
    console.log(`👁️ Visualizando documento: ${doc.name}`);
    // Modal não implementado para documentos financeiros ainda
    alert('Visualização em modal não implementada para documentos financeiros');
  }

  deleteDocument(document: FinancialDocument): void {
    if (confirm(`Tem certeza que deseja excluir o documento "${document.name}"?`)) {
      this.documents = this.documents.filter(d => d.id !== document.id);
      this.filterDocuments();
      console.log(`Documento excluído: ${document.name}`);
      // TODO: Implementar exclusão no backend
    }
  }

  navigateBack(): void {
    this.router.navigate(['/documentacoes-financeiras']);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'active':
        return 'Ativo';
      case 'pending':
        return 'Pendente';
      case 'archived':
        return 'Arquivado';
      default:
        return 'Desconhecido';
    }
  }

  getFileTypeIcon(type: string): string {
    switch (type.toUpperCase()) {
      case 'PDF':
        return '📄';
      case 'DOC':
      case 'DOCX':
        return '📝';
      case 'XLS':
      case 'XLSX':
        return '📊';
      case 'JPG':
      case 'JPEG':
      case 'PNG':
        return '🖼️';
      default:
        return '📎';
    }
  }

  getDocumentsByStatus(status: string): number {
    return this.documents.filter(doc => doc.status === status).length;
  }
}