import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface ServerFile {
  id: string;
  name: string;
  type: 'pdf' | 'img' | 'doc' | 'other';
  size: string;
  lastModified: Date;
}

interface Server {
  id: string;
  name: string;
  ip: string;
  status: 'online' | 'offline';
}

@Component({
  selector: 'app-server-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './server-details.component.html',
  styleUrls: ['./server-details.component.scss']
})
export class ServerDetailsComponent implements OnInit {
  server: Server | null = null;
  files: ServerFile[] = [];
  searchTerm: string = '';
  filteredFiles: ServerFile[] = [];
  letter: string = '';

  // Mapeamento de IDs para nomes de servidores
  private serverNames: { [key: string]: string } = {
    '65': 'Ana Maria',
    '74': 'João Santos', 
    '77': 'Maria Silva',
    '66': 'Bruno Costa',
    '67': 'Carla Pereira'
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const serverId = this.route.snapshot.params['id'];
    this.letter = this.route.snapshot.params['letter'] || '';
    this.loadServerDetails(serverId);
    this.loadServerFiles(serverId);
  }

  loadServerDetails(serverId: string): void {
    // Buscar nome do servidor no mapeamento ou usar um padrão
    const serverName = this.serverNames[serverId] || `Servidor ${serverId}`;
    
    this.server = {
      id: serverId,
      name: serverName,
      ip: '192.168.1.' + serverId,
      status: 'online'
    };
  }

  loadServerFiles(serverId: string): void {
    // Arquivos específicos baseados no servidor
    const serverName = this.serverNames[serverId] || `Servidor ${serverId}`;
    
    if (serverId === '65') { // Ana Maria
      this.files = [
        {
          id: '1',
          name: 'CPF',
          type: 'pdf',
          size: '2.5 MB',
          lastModified: new Date('2024-11-08')
        },
        {
          id: '2',
          name: 'Comprovante de Residência',
          type: 'pdf',
          size: '1.8 MB',
          lastModified: new Date('2024-11-07')
        },
        {
          id: '3',
          name: 'RG',
          type: 'img',
          size: '3.2 MB',
          lastModified: new Date('2024-11-06')
        }
      ];
    } else if (serverId === '74') { // João Santos
      this.files = [
        {
          id: '1',
          name: 'Carteira de Trabalho',
          type: 'pdf',
          size: '1.9 MB',
          lastModified: new Date('2024-11-09')
        },
        {
          id: '2',
          name: 'Comprovante de Renda',
          type: 'pdf',
          size: '1.2 MB',
          lastModified: new Date('2024-11-08')
        },
        {
          id: '3',
          name: 'Certidão de Nascimento',
          type: 'doc',
          size: '856 KB',
          lastModified: new Date('2024-11-07')
        }
      ];
    } else if (serverId === '77') { // Maria Silva
      this.files = [
        {
          id: '1',
          name: 'Passaporte',
          type: 'img',
          size: '4.1 MB',
          lastModified: new Date('2024-11-10')
        },
        {
          id: '2',
          name: 'Diploma Universitário',
          type: 'pdf',
          size: '3.7 MB',
          lastModified: new Date('2024-11-09')
        },
        {
          id: '3',
          name: 'Certificado de Idiomas',
          type: 'pdf',
          size: '2.3 MB',
          lastModified: new Date('2024-11-08')
        },
        {
          id: '4',
          name: 'Currículo',
          type: 'doc',
          size: '1.1 MB',
          lastModified: new Date('2024-11-07')
        }
      ];
    } else {
      // Arquivos padrão para outros servidores
      this.files = [
        {
          id: '1',
          name: 'Documento Pessoal',
          type: 'pdf',
          size: '2.0 MB',
          lastModified: new Date('2024-11-08')
        },
        {
          id: '2',
          name: 'Foto do Documento',
          type: 'img',
          size: '1.5 MB',
          lastModified: new Date('2024-11-07')
        }
      ];
    }
    
    this.filteredFiles = [...this.files];
  }

  onSearch(): void {
    if (this.searchTerm.trim() === '') {
      this.filteredFiles = [...this.files];
    } else {
      this.filteredFiles = this.files.filter(file =>
        file.name.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
  }

  getFileIcon(fileType: string): string {
    switch (fileType) {
      case 'pdf':
        return 'M7 18H17V16H7V18Z M10 15H14V17H10V15Z M7 14H17V12H7V14Z M10 11H14V13H10V11Z';
      case 'img':
        return 'M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19ZM13.96 12.29L11.21 15.83L9.25 13.47L6.5 17H17.5L13.96 12.29Z';
      case 'doc':
        return 'M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20Z';
      default:
        return 'M13 9H18.5L13 3.5V9ZM6 2H14L20 8V20C20 21.1 19.1 22 18 22H6C4.89 22 4 21.1 4 20V4C4 2.9 4.89 2 6 2ZM15 18V16H6V18H15ZM18 14V12H6V14H18Z';
    }
  }

  downloadFile(file: ServerFile): void {
    // Implementar download do arquivo
    console.log('Downloading file:', file.name);
    // Simular download
    const link = document.createElement('a');
    link.href = `#`; // Em uma implementação real, seria a URL do arquivo
    link.download = file.name;
    link.click();
  }

  viewFile(file: ServerFile): void {
    // Implementar visualização do arquivo
    console.log('Viewing file:', file.name);
    // Simular abertura em nova aba
    window.open(`#`, '_blank'); // Em uma implementação real, seria a URL do arquivo
  }

  openFile(file: ServerFile): void {
    // Ao clicar no arquivo, visualiza por padrão
    this.viewFile(file);
  }

  goBack(): void {
    if (this.letter) {
      // Se veio de uma lista de letra específica, volta para ela
      this.router.navigate(['/servers', this.letter]);
    } else {
      // Caso contrário, volta para a lista geral
      this.router.navigate(['/servers']);
    }
  }
}