import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

interface User {
  id: number;
  name: string;
  email: string;
  user_type: 'admin' | 'prefeitura';
  municipality?: string;
  role: string;
  active: boolean;
  created_at: string;
}

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.scss']
})
export class UsersListComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  paginatedUsers: User[] = [];
  isLoading = true;
  searchTerm = '';
  selectedFilter = 'all';
  
  // Paginação
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  totalItems = 0;
  itemsPerPageOptions = [5, 10, 25, 50];

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    
    this.http.get<any>(`${environment.apiUrl}/auth/users`).subscribe({
      next: (response) => {
        console.log('✅ Usuários carregados:', response);
        this.users = response.data || [];
        this.filteredUsers = [...this.users];
        this.updatePagination();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Erro ao carregar usuários:', error);
        this.isLoading = false;
        alert('Erro ao carregar usuários. Verifique se o backend está rodando.');
      }
    });
  }

  getMockUsers(): User[] {
    return [
      {
        id: 1,
        name: 'Admin ArqServ',
        email: 'admin@arqserv.com',
        user_type: 'admin',
        role: 'admin',
        active: true,
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        name: 'Prefeitura São Paulo',
        email: 'prefeitura@saopaulo.sp.gov.br',
        user_type: 'prefeitura',
        municipality: 'São Paulo',
        role: 'user',
        active: true,
        created_at: new Date().toISOString()
      },
      {
        id: 3,
        name: 'Teste Usuario',
        email: 'teste@exemplo.com',
        user_type: 'prefeitura',
        municipality: 'São Paulo',
        role: 'user',
        active: true,
        created_at: new Date().toISOString()
      }
    ];
  }

  onSearch(event: any): void {
    this.searchTerm = event.target.value.toLowerCase();
    this.applyFilters();
  }

  onFilterChange(event: any): void {
    this.selectedFilter = event.target.value;
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredUsers = this.users.filter(user => {
      const matchesSearch = 
        user.name.toLowerCase().includes(this.searchTerm) ||
        user.email.toLowerCase().includes(this.searchTerm) ||
        (user.municipality && user.municipality.toLowerCase().includes(this.searchTerm));

      const matchesFilter = 
        this.selectedFilter === 'all' ||
        this.selectedFilter === user.user_type ||
        (this.selectedFilter === 'active' && user.active) ||
        (this.selectedFilter === 'inactive' && !user.active);

      return matchesSearch && matchesFilter;
    });
    
    this.currentPage = 1; // Reset para primeira página ao filtrar
    this.updatePagination();
  }

  navigateToNewUser(): void {
    this.router.navigate(['/users/new']);
  }

  editUser(user: User): void {
    console.log('Editar usuário:', user);
    // TODO: Implementar edição
  }

  toggleUserStatus(user: User): void {
    console.log('Alterar status do usuário:', user);
    // TODO: Implementar ativação/desativação
  }

  deleteUser(user: User): void {
    if (confirm(`Tem certeza que deseja excluir o usuário "${user.name}"?`)) {
      console.log('Excluir usuário:', user);
      // TODO: Implementar exclusão
    }
  }

  getUserTypeLabel(userType: string): string {
    return userType === 'admin' ? 'ArqServ' : 'Prefeitura';
  }

  getUserTypeColor(userType: string): string {
    return userType === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  }

  getRoleLabel(role: string): string {
    return role === 'admin' ? 'Admin' : 'Usuário';
  }

  getRoleColor(role: string): string {
    return role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800';
  }

  getStatusColor(active: boolean): string {
    return active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  }

  getStatusLabel(active: boolean): string {
    return active ? 'Ativo' : 'Inativo';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('pt-BR');
  }

  getAdminTypeCount(): number {
    return this.users.filter(u => u.user_type === 'admin').length;
  }

  getPrefeituraTypeCount(): number {
    return this.users.filter(u => u.user_type === 'prefeitura').length;
  }

  getAdminRoleCount(): number {
    return this.users.filter(u => u.role === 'admin').length;
  }

  getTotalUsersCount(): number {
    return this.users.length;
  }

  // Métodos de paginação
  updatePagination(): void {
    this.totalItems = this.filteredUsers.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
    
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedUsers = this.filteredUsers.slice(startIndex, endIndex);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  getPaginationInfo(): string {
    const start = (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
    return `${start}-${end} de ${this.totalItems} usuários`;
  }

  onItemsPerPageChange(event: any): void {
    this.itemsPerPage = Number(event.target.value);
    this.currentPage = 1; // Reset para primeira página
    this.updatePagination();
  }
}