import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../../shared/services/auth.service';

@Component({
    selector: 'app-change-password-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './change-password-modal.component.html'
})
export class ChangePasswordModalComponent {
    @Output() close = new EventEmitter<void>();

    changePasswordForm: FormGroup;
    isLoading = false;
    successMessage = '';
    errorMessage = '';

    constructor(
        private fb: FormBuilder,
        private authService: AuthService
    ) {
        this.changePasswordForm = this.fb.group({
            password: ['', [Validators.required, Validators.minLength(6)]],
            confirmPassword: ['', [Validators.required]]
        }, { validators: this.passwordMatchValidator });
    }

    passwordMatchValidator(g: FormGroup) {
        return g.get('password')?.value === g.get('confirmPassword')?.value
            ? null : { mismatch: true };
    }

    onSubmit() {
        if (this.changePasswordForm.valid) {
            this.isLoading = true;
            this.errorMessage = '';
            this.successMessage = '';

            const newPassword = this.changePasswordForm.get('password')?.value;

            this.authService.updatePassword(newPassword).subscribe({
                next: () => {
                    this.isLoading = false;
                    this.successMessage = 'Senha alterada com sucesso!';
                    this.changePasswordForm.reset();
                    // Fechar modal após 2 segundos
                    setTimeout(() => {
                        this.close.emit();
                    }, 2000);
                },
                error: (err) => {
                    this.isLoading = false;
                    this.errorMessage = err.message || 'Erro ao alterar a senha. Tente novamente.';
                    console.error('Erro ao alterar senha:', err);
                }
            });
        }
    }

    onClose() {
        this.close.emit();
    }
}
