import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../shared/services/auth.service';
import { environment } from '../../../../../environments/environment';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  municipality_code?: string;
  created_at: string;
}

interface CreateUserForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  municipality_code?: string;
}

interface Municipality {
  id: number;
  code: string;
  name: string;
  state: string;
}

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  itemsPerPage = 5;
  totalPages = 0;
  totalItems = 0;

  // Municípios
  municipalities: Municipality[] = [];
  loadingMunicipalities = false;
  itemsPerPageOptions = [5, 10, 25, 50];

  currentUser: any | null = null;

  // Modal de criação de usuário
  showCreateModal = false;
  isCreating = false;

  // Modal de sucesso
  showSuccessModal = false;
  successModalData: {
    userName: string;
    userEmail: string;
    userRole: string;
    userMunicipality?: string;
  } = {
      userName: '',
      userEmail: '',
      userRole: '',
      userMunicipality: ''
    };

  // Modal de erro
  showErrorModal = false;
  errorMessage = '';
  errorTitle = 'Erro';

  createUserForm: CreateUserForm = {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    municipality_code: ''
  };

  // Modal de Edição
  showEditModal = false;
  isEditing = false;
  showPasswordFields = false; // Controle de visibilidade dos campos de senha
  editUserForm: CreateUserForm = {
    name: '',
    email: '',
    password: '', // Não usado na edição por enquanto
    confirmPassword: '', // Não usado na edição por enquanto
    role: '',
    municipality_code: ''
  };
  editingUserId: number | null = null;

  // Modal de Deleção
  showDeleteModal = false;
  isDeleting = false;
  userToDelete: User | null = null;

  constructor(
    private router: Router,
    private http: HttpClient
    , private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.loadUsers();
    this.loadMunicipalities(); // Carregar municípios para exibir nomes na lista
    // Subscribe to current user to conditionally show invite button
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
    });
  }

  loadUsers(): void {
    this.isLoading = true;

    // Pegar token do localStorage
    const token = localStorage.getItem('arqserv_token');

    if (!token) {
      console.error('❌ Token não encontrado');
      this.isLoading = false;
      this.showError('Login Necessário', 'Você precisa estar logado para acessar esta página.');
      this.router.navigate(['/auth/login']);
      return;
    }

    // Buscar usuários do endpoint admin
    this.http.get<any>(`${environment.apiUrl}/admin/users`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).subscribe({
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

        if (error.status === 401 || error.status === 403) {
          this.showError('Sem Permissão', 'Você não tem permissão para acessar esta página.');
          this.router.navigate(['/dashboard']);
        } else {
          this.showError('Erro de Conexão', 'Erro ao carregar usuários. Verifique se o backend está rodando.');
        }
      }
    });
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
        user.role.toLowerCase().includes(this.searchTerm);

      const matchesFilter =
        this.selectedFilter === 'all' ||
        this.selectedFilter === user.role ||
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

  // Simple prompt-based invite helper
  inviteUserPrompt(): void {
    const email = prompt('Digite o e-mail para enviar o convite:');
    if (!email) return;
    if (!confirm(`Enviar convite para ${email}?`)) return;
    this.authService.invite(email).subscribe({
      next: (resp) => {
        // Mostrar sucesso no modal existente
        this.successModalData = {
          userName: 'Convite',
          userEmail: email,
          userRole: 'Enviado'
        };
        this.showSuccessModal = true;
      },
      error: (err) => {
        console.error('Erro ao enviar convite', err);
        this.showError('Erro no Convite', 'Erro ao enviar convite. Veja o console para detalhes.');
      }
    });
  }



  editUser(user: User): void {
    console.log('Editar usuário:', user);
    this.editingUserId = user.id;
    this.showPasswordFields = false; // Resetar visibilidade dos campos de senha
    this.editUserForm = {
      name: user.name,
      email: user.email,
      password: '',
      confirmPassword: '',
      role: user.role,
      municipality_code: (user as any).municipality_code || ''
    };

    // Carregar municípios se necessário
    if (this.municipalities.length === 0) {
      this.loadMunicipalities();
    }

    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editingUserId = null;
    this.showPasswordFields = false;
    this.resetCreateForm(); // Reusa lógica de reset
  }

  updateUser(): void {
    if (!this.editingUserId) return;

    // Validações básicas
    if (!this.editUserForm.name || !this.editUserForm.email || !this.editUserForm.role) {
      this.showError('Campos Obrigatórios', 'Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (this.editUserForm.role === 'user' && !this.editUserForm.municipality_code) {
      this.showError('Município Obrigatório', 'Por favor, selecione um município para usuários do tipo "Usuário".');
      return;
    }

    // Validar senha se foi fornecida
    if (this.editUserForm.password) {
      if (this.editUserForm.password !== this.editUserForm.confirmPassword) {
        this.showError('Senhas Diferentes', 'As senhas digitadas não coincidem.');
        return;
      }
      if (this.editUserForm.password.length < 6) {
        this.showError('Senha Muito Curta', 'A senha deve ter no mínimo 6 caracteres.');
        return;
      }
    }

    this.isEditing = true;
    const token = localStorage.getItem('arqserv_token');

    if (!token) {
      this.router.navigate(['/auth/login']);
      return;
    }

    const updateData: any = {
      name: this.editUserForm.name,
      email: this.editUserForm.email,
      role: this.editUserForm.role,
      municipality_code: this.editUserForm.municipality_code
    };

    // Incluir senha se fornecida
    if (this.editUserForm.password) {
      updateData.password = this.editUserForm.password;
    }

    this.http.put<any>(`${environment.apiUrl}/admin/users/${this.editingUserId}`, updateData, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (response) => {
        console.log('✅ Usuário atualizado:', response);
        this.isEditing = false;
        this.closeEditModal();
        this.loadUsers(); // Recarregar lista

        // Mostrar sucesso (opcional, usando snackbar seria melhor, mas vamos usar o modal de sucesso existente)
        this.successModalData = {
          userName: this.editUserForm.name,
          userEmail: this.editUserForm.email,
          userRole: this.editUserForm.role === 'admin' ? 'Administrador' : 'Usuário',
          userMunicipality: 'Atualizado com Sucesso'
        };
        this.showSuccessModal = true;
      },
      error: (error) => {
        console.error('❌ Erro ao atualizar:', error);
        this.isEditing = false;
        this.showError('Erro na Atualização', error.error?.message || 'Falha ao atualizar usuário.');
      }
    });
  }



  deleteUser(user: User): void {
    this.userToDelete = user;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.userToDelete = null;
  }

  confirmDeleteUser(): void {
    if (!this.userToDelete) return;

    this.isDeleting = true;
    const token = localStorage.getItem('arqserv_token');

    this.http.delete<any>(`${environment.apiUrl}/admin/users/${this.userToDelete.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (response) => {
        console.log('✅ Usuário excluído:', response);
        this.isDeleting = false;
        this.closeDeleteModal();
        this.loadUsers();
      },
      error: (error) => {
        console.error('❌ Erro ao excluir:', error);
        this.isDeleting = false;
        this.closeDeleteModal(); // Fecha modal de confirmação para mostrar o erro
        this.showError('Erro na Exclusão', error.error?.message || 'Falha ao excluir usuário.');
      }
    });
  }

  toggleUserAccess(user: User): void {
    const token = localStorage.getItem('arqserv_token');
    if (!token) {
      this.router.navigate(['/auth/login']);
      return;
    }

    // Atualização otimista da UI
    const previousState = user.active;
    user.active = !user.active;

    this.http.patch<any>(`${environment.apiUrl}/admin/users/${user.id}/toggle-active`, { is_active: user.active }, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (response) => {
        console.log('✅ Acesso do usuário alterado:', response);
        // UI já foi atualizada otimisticamente
      },
      error: (error) => {
        console.error('❌ Erro ao alterar acesso:', error);
        // Reverter atualização otimista em caso de erro
        user.active = previousState;
        this.showError('Erro ao Alterar Acesso', error.error?.message || 'Falha ao alterar acesso do usuário.');
      }
    });
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      'superadmin': 'Super Administrador',
      'admin': 'Administrador',
      'manager': 'Gerenciador',
      'user': 'Usuário'
    };
    return labels[role] || role;
  }

  getRoleColor(role: string): string {
    const colors: Record<string, string> = {
      'superadmin': 'bg-red-100 text-red-800',
      'admin': 'bg-purple-100 text-purple-800',
      'manager': 'bg-blue-100 text-blue-800',
      'user': 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  }

  getStatusColor(active: boolean): string {
    return active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  }

  getStatusLabel(active: boolean): string {
    return active ? 'Ativo' : 'Inativo';
  }

  getMunicipalityName(code: string): string {
    if (!code) return '-';
    // Se a lista de municípios ainda não estiver carregada ou vazia
    if (!this.municipalities || this.municipalities.length === 0) return code;

    const municipality = this.municipalities.find(m => m.code === code);
    return municipality ? municipality.name : code;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('pt-BR');
  }

  getAdminTypeCount(): number {
    return this.users.filter(u => u.role === 'admin').length;
  }

  getPrefeituraTypeCount(): number {
    return this.users.filter(u => u.role === 'user').length;
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

  // Métodos do modal de criação
  openCreateModal(): void {
    this.showCreateModal = true;
    this.resetCreateForm();
    this.loadMunicipalities();
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.resetCreateForm();
  }

  closeSuccessModal(): void {
    this.showSuccessModal = false;
  }

  closeErrorModal(): void {
    this.showErrorModal = false;
    this.errorMessage = '';
    this.errorTitle = 'Erro';
  }

  // Método utilitário para mostrar erros em modal
  showError(title: string, message: string): void {
    this.errorTitle = title;
    this.errorMessage = message;
    this.showErrorModal = true;
  }

  resetCreateForm(): void {
    this.createUserForm = {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: '',
      municipality_code: ''
    };
  }

  createUser(): void {
    // Validações
    if (!this.createUserForm.name || !this.createUserForm.email || !this.createUserForm.password || !this.createUserForm.role) {
      this.showError('Campos Obrigatórios', 'Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (this.createUserForm.password !== this.createUserForm.confirmPassword) {
      this.showError('Senhas Diferentes', 'As senhas digitadas não coincidem. Verifique e tente novamente.');
      return;
    }

    if (this.createUserForm.password.length < 6) {
      this.showError('Senha Muito Curta', 'A senha deve ter no mínimo 6 caracteres para garantir a segurança.');
      return;
    }

    // Validar município para usuários tipo 'user'
    if (this.createUserForm.role === 'user' && !this.createUserForm.municipality_code) {
      this.showError('Município Obrigatório', 'Por favor, selecione um município para usuários do tipo "Usuário".');
      return;
    }

    this.isCreating = true;

    const token = localStorage.getItem('arqserv_token');

    if (!token) {
      this.showError('Login Necessário', 'Você precisa estar logado para realizar esta ação.');
      this.router.navigate(['/auth/login']);
      return;
    }

    // Preparar dados para envio (sem confirmPassword)
    const userData: any = {
      name: this.createUserForm.name,
      email: this.createUserForm.email,
      password: this.createUserForm.password,
      role: this.createUserForm.role
    };

    // Incluir municipality_code apenas para usuários tipo 'user'
    if (this.createUserForm.role === 'user' && this.createUserForm.municipality_code) {
      userData.municipality_code = this.createUserForm.municipality_code;
    }

    this.http.post<any>(`${environment.apiUrl}/admin/users`, userData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (response) => {
        console.log('✅ Usuário criado:', response);

        // Preencher dados do modal de sucesso
        this.successModalData = {
          userName: this.createUserForm.name,
          userEmail: this.createUserForm.email,
          userRole: this.createUserForm.role === 'admin' ? 'Administrador' : 'Usuário',
          userMunicipality: this.createUserForm.role === 'user'
            ? this.municipalities.find(m => m.code === this.createUserForm.municipality_code)?.name || 'N/A'
            : undefined
        };

        // Fechar modal de criação e mostrar modal de sucesso
        this.closeCreateModal();
        this.showSuccessModal = true;

        // Recarregar lista
        this.loadUsers();
        this.isCreating = false;
      },
      error: (error) => {
        console.error('❌ Erro ao criar usuário:', error);
        this.isCreating = false;

        // Tratar erro de limite de usuários
        if (error.error?.code === 'USER_LIMIT_REACHED') {
          this.errorTitle = 'Limite Atingido';
          this.errorMessage = error.error.message;
        } else if (error.error?.code === 'INSUFFICIENT_PERMISSIONS') {
          this.errorTitle = 'Sem Permissão';
          this.errorMessage = error.error.message;
        } else if (error.error?.code === 'EMAIL_EXISTS') {
          this.errorTitle = 'Email já Cadastrado';
          this.errorMessage = 'Este email já está sendo usado por outro usuário. Tente com um email diferente.';
        } else if (error.error?.message) {
          this.errorTitle = 'Erro no Cadastro';
          this.errorMessage = error.error.message;
        } else if (error.status === 400) {
          this.errorTitle = 'Dados Inválidos';
          this.errorMessage = 'Verifique se todos os campos foram preenchidos corretamente.';
        } else if (error.status === 401 || error.status === 403) {
          this.errorTitle = 'Sem Permissão';
          this.errorMessage = 'Você não tem permissão para criar usuários.';
        } else {
          this.errorTitle = 'Erro Inesperado';
          this.errorMessage = 'Ocorreu um erro ao tentar criar o usuário. Tente novamente.';
        }

        // Mostrar modal de erro
        this.showErrorModal = true;
      }
    });
  }

  loadMunicipalities(): void {
    this.loadingMunicipalities = true;
    console.log('🏛️ Carregando municípios da API...');

    this.http.get<any>(`${environment.apiUrl}/municipalities`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.municipalities = response.data.map((municipality: any) => ({
            id: municipality.id,
            code: municipality.code,
            name: municipality.name,
            state: municipality.state
          })).sort((a: any, b: any) => a.name.localeCompare(b.name));

          console.log(`✅ ${this.municipalities.length} municípios carregados da API`);
        } else {
          console.warn('⚠️ API retornou resposta sem dados, usando lista mockada');
          this.loadMockMunicipalities();
        }
        this.loadingMunicipalities = false;
      },
      error: (error) => {
        console.warn('⚠️ Erro ao carregar municípios da API, usando lista mockada:', error);
        this.loadMockMunicipalities();
        this.loadingMunicipalities = false;
      }
    });
  }

  private loadMockMunicipalities(): void {
    this.municipalities = [
      { id: 1, code: '3550308', name: 'São Paulo', state: 'SP' },
      { id: 2, code: '3304557', name: 'Rio de Janeiro', state: 'RJ' },
      { id: 3, code: '3106200', name: 'Belo Horizonte', state: 'MG' },
      { id: 4, code: '5300108', name: 'Brasília', state: 'DF' },
      { id: 5, code: '4106902', name: 'Curitiba', state: 'PR' },
      { id: 6, code: '2304400', name: 'Fortaleza', state: 'CE' },
      { id: 7, code: '2927408', name: 'Salvador', state: 'BA' },
      { id: 8, code: '2611606', name: 'Recife', state: 'PE' },
      { id: 9, code: '4314902', name: 'Porto Alegre', state: 'RS' },
      { id: 10, code: '5208707', name: 'Goiânia', state: 'GO' }
    ].sort((a, b) => a.name.localeCompare(b.name));
  }
}