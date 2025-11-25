import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../shared/services/auth.service';
import { environment } from '../../../../../environments/environment';

interface Municipality {
  id: number;
  name: string;
  state: string;
}

@Component({
  selector: 'app-user-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-registration.component.html',
  styleUrls: ['./user-registration.component.scss']
})
export class UserRegistrationComponent implements OnInit {
  userForm: FormGroup;
  isLoading = false;
  municipalities: Municipality[] = [];
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.userForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      user_type: ['prefeitura', [Validators.required]],
      municipality: [''],
      role: ['user', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    // Quando o tipo de usuário mudar, ajustar validações
    this.userForm.get('user_type')?.valueChanges.subscribe(type => {
      const municipalityControl = this.userForm.get('municipality');
      
      if (type === 'admin') {
        municipalityControl?.clearValidators();
        municipalityControl?.setValue('');
      } else {
        municipalityControl?.setValidators([Validators.required]);
      }
      
      municipalityControl?.updateValueAndValidity();
    });
  }

  ngOnInit(): void {
    this.loadMunicipalities();
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    
    if (password?.value !== confirmPassword?.value) {
      confirmPassword?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    if (confirmPassword?.hasError('passwordMismatch')) {
      delete confirmPassword.errors!['passwordMismatch'];
      if (Object.keys(confirmPassword.errors!).length === 0) {
        confirmPassword.setErrors(null);
      }
    }
    
    return null;
  }

  loadMunicipalities(): void {
    // Lista de municípios do Brasil (exemplo com alguns principais)
    this.municipalities = [
      { id: 1, name: 'São Paulo', state: 'SP' },
      { id: 2, name: 'Rio de Janeiro', state: 'RJ' },
      { id: 3, name: 'Belo Horizonte', state: 'MG' },
      { id: 4, name: 'Brasília', state: 'DF' },
      { id: 5, name: 'Salvador', state: 'BA' },
      { id: 6, name: 'Fortaleza', state: 'CE' },
      { id: 7, name: 'Curitiba', state: 'PR' },
      { id: 8, name: 'Recife', state: 'PE' },
      { id: 9, name: 'Porto Alegre', state: 'RS' },
      { id: 10, name: 'Goiânia', state: 'GO' },
      { id: 11, name: 'Belém', state: 'PA' },
      { id: 12, name: 'Guarulhos', state: 'SP' },
      { id: 13, name: 'Campinas', state: 'SP' },
      { id: 14, name: 'São Luís', state: 'MA' },
      { id: 15, name: 'Maceió', state: 'AL' }
    ].sort((a, b) => a.name.localeCompare(b.name));
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onSubmit(): void {
    if (this.userForm.valid) {
      this.isLoading = true;
      
      const formData = { ...this.userForm.value };
      delete formData.confirmPassword; // Remove confirmPassword antes de enviar
      
      // Se é admin (tipo), remover municipality
      if (formData.user_type === 'admin') {
        delete formData.municipality;
      }

      this.authService.register(formData.name, formData.email, formData.password, formData.user_type, formData.municipality, formData.role)
        .subscribe({
          next: (response: any) => {
            console.log('✅ Usuário cadastrado com sucesso:', response);
            alert('Usuário cadastrado com sucesso!');
            this.router.navigate(['/users']); // Navegar para lista de usuários
          },
          error: (error) => {
            console.error('❌ Erro ao cadastrar usuário:', error);
            alert(error.error?.message || error.message || 'Erro ao cadastrar usuário. Tente novamente.');
            this.isLoading = false;
          }
        });
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.userForm.controls).forEach(key => {
      const control = this.userForm.get(key);
      control?.markAsTouched();
    });
  }

  goBack(): void {
    this.router.navigate(['/users']);
  }

  getFieldError(fieldName: string): string {
    const field = this.userForm.get(fieldName);
    
    if (field?.touched && field?.errors) {
      if (field.errors['required']) return `${this.getFieldLabel(fieldName)} é obrigatório`;
      if (field.errors['email']) return 'Email inválido';
      if (field.errors['minlength']) return `${this.getFieldLabel(fieldName)} deve ter pelo menos ${field.errors['minlength'].requiredLength} caracteres`;
      if (field.errors['passwordMismatch']) return 'As senhas não coincidem';
    }
    
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      name: 'Nome',
      email: 'Email',
      password: 'Senha',
      confirmPassword: 'Confirmação de senha',
      user_type: 'Tipo de usuário',
      municipality: 'Município',
      role: 'Nível de acesso'
    };
    return labels[fieldName] || fieldName;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.userForm.get(fieldName);
    return !!(field?.touched && field?.errors);
  }
}