import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../../shared/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './login-simple.component.html',
  styleUrls: ['./login-simple.component.scss']
})
export class LoginSimpleComponent {
  loginForm: FormGroup;
  hidePassword = true;
  loading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.loading = true;
      this.errorMessage = '';
      const { email, password } = this.loginForm.value;

      this.authService.login(email, password).subscribe({
        next: (response) => {
          this.loading = false;
          console.log('Login realizado com sucesso!');
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          this.loading = false;
          console.error('Erro ao fazer login:', error);
          this.errorMessage = 'Erro ao fazer login. Verifique suas credenciais.';
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      control?.markAsTouched();
    });
  }

  getErrorMessage(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    
    if (field?.hasError('required')) {
      return `${fieldName === 'email' ? 'E-mail' : 'Senha'} é obrigatório`;
    }
    
    if (field?.hasError('email')) {
      return 'E-mail inválido';
    }
    
    if (field?.hasError('minlength')) {
      return 'Senha deve ter pelo menos 6 caracteres';
    }
    
    return '';
  }

  togglePassword(): void {
    this.hidePassword = !this.hidePassword;
  }

  fillTestAccount(type: 'empresa' | 'prefeitura'): void {
    if (type === 'empresa') {
      this.loginForm.patchValue({
        email: 'empresa@test.com',
        password: '123456'
      });
    } else {
      this.loginForm.patchValue({
        email: 'prefeitura@test.com',
        password: '123456'
      });
    }
    this.errorMessage = '';
  }
}