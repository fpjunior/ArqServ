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
    isVerified = false;
    isVerifying = false;

    showCurrentPassword = false;
    showNewPassword = false;
    showConfirmPassword = false;

    constructor(
        private fb: FormBuilder,
        private authService: AuthService
    ) {
        this.changePasswordForm = this.fb.group({
            currentPassword: ['', [Validators.required]],
            password: ['', [Validators.required, Validators.minLength(6)]],
            confirmPassword: ['', [Validators.required]]
        }, { validators: this.passwordMatchValidator });
    }

    passwordMatchValidator(g: FormGroup) {
        return g.get('password')?.value === g.get('confirmPassword')?.value
            ? null : { mismatch: true };
    }

    verifyCurrentPassword() {
        const currentPassword = this.changePasswordForm.get('currentPassword')?.value;
        if (!currentPassword) return;

        this.isVerifying = true;
        this.errorMessage = '';

        this.authService.verifyCurrentPassword(currentPassword).subscribe({
            next: (isValid) => {
                this.isVerifying = false;
                if (isValid) {
                    this.isVerified = true;
                    this.changePasswordForm.get('currentPassword')?.disable();
                } else {
                    this.errorMessage = 'Senha atual incorreta.';
                    this.changePasswordForm.get('currentPassword')?.setErrors({ invalid: true });
                }
            },
            error: () => {
                this.isVerifying = false;
                this.errorMessage = 'Erro ao verificar senha.';
            }
        });
    }

    togglePasswordVisibility(field: 'current' | 'new' | 'confirm') {
        if (field === 'current') {
            this.showCurrentPassword = !this.showCurrentPassword;
        } else if (field === 'new') {
            this.showNewPassword = !this.showNewPassword;
        } else if (field === 'confirm') {
            this.showConfirmPassword = !this.showConfirmPassword;
        }
    }

    onSubmit() {
        if (this.changePasswordForm.valid && this.isVerified) {
            this.isLoading = true;
            this.errorMessage = '';
            this.successMessage = '';

            const newPassword = this.changePasswordForm.get('password')?.value;

            this.authService.updatePassword(newPassword).subscribe({
                next: () => {
                    this.isLoading = false;
                    this.successMessage = 'Senha alterada com sucesso!';
                    this.changePasswordForm.reset();
                    this.isVerified = false;
                    this.changePasswordForm.get('currentPassword')?.enable();

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
