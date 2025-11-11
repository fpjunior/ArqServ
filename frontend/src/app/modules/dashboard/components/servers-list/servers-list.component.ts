import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, User } from '../../../../shared/services/auth.service';

interface ServerGroups {
  [key: string]: number;
}

@Component({
  selector: 'app-servers-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './servers-list.component.html',
  styleUrls: ['./servers-list.component.scss']
})
export class ServersListComponent implements OnInit {
  currentUser: User | null = null;
  searchTerm: string = '';
  
  // Array com todas as letras do alfabeto
  alphabet: string[] = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
  ];

  // Cores disponíveis para os grupos (rotacionando)
  colors: string[] = ['blue', 'green', 'red', 'purple', 'indigo', 'yellow', 'pink', 'gray'];
  
  serverGroups: ServerGroups = {};

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUserData();
    this.initializeServerGroups();
  }

  private initializeServerGroups(): void {
    // Inicializar todos os grupos do alfabeto com números aleatórios
    this.alphabet.forEach(letter => {
      this.serverGroups[letter] = Math.floor(Math.random() * 50) + 1; // 1 a 50 servidores por grupo
    });
  }

  private loadUserData(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (!this.currentUser) {
        this.router.navigate(['/auth/login']);
      } else if (this.currentUser?.role === 'prefeitura') {
        // Ajustar grupos de servidores para prefeitura (valores menores)
        this.alphabet.forEach(letter => {
          this.serverGroups[letter] = Math.floor(this.serverGroups[letter] / 2) || 1;
        });
      }
    });
  }

  getGroupColor(letter: string): string {
    // Retorna uma cor baseada no índice da letra no alfabeto
    const index = this.alphabet.indexOf(letter);
    return this.colors[index % this.colors.length];
  }

  navigateToGroup(letter: string): void {
    console.log(`Navegando para servidores com letra ${letter}`);
    // Navegar para a página de servidores por letra
    this.router.navigate(['/servers', letter]);
  }

  onSearch(): void {
    console.log('Buscando por:', this.searchTerm);
    // TODO: Implementar funcionalidade de busca
  }
}