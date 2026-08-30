import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService, type LoginProvider } from '../../../../core/services/auth';
import { I18nService } from '../../../../core/services/i18n';
import { LOGIN_PROVIDER_LABEL_KEYS } from '../../../../core/i18n/messages';
import { ModalService } from '../../../../core/services/modal';
import { ToastService } from '../../../../core/services/toast';
import { MIN_PASSWORD_LENGTH } from '../../../../shared/constants/password-policy';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Input } from '../../../../shared/ui/input/input';

const PROVIDERS: readonly LoginProvider[] = ['password', 'google', 'telegram'];

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule, Button, Input],
  templateUrl: './profile-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);

  protected readonly user = this.auth.user;
  protected readonly providers = PROVIDERS;
  protected readonly providerLabelKeys = LOGIN_PROVIDER_LABEL_KEYS;

  protected readonly form = new FormGroup({
    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)],
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected get currentPasswordError(): string | null {
    const control = this.form.controls.currentPassword;
    return control.touched && control.hasError('required')
      ? this.i18n.t('auth.error.passwordRequired')
      : null;
  }

  protected get newPasswordError(): string | null {
    const control = this.form.controls.newPassword;
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required')
      ? this.i18n.t('auth.error.passwordRequired')
      : this.i18n.t('auth.error.passwordTooShort', { min: MIN_PASSWORD_LENGTH });
  }

  protected get confirmPasswordError(): string | null {
    const control = this.form.controls.confirmPassword;
    if (!control.touched) {
      return null;
    }
    if (control.hasError('required')) {
      return this.i18n.t('auth.error.passwordRequired');
    }
    return control.value !== this.form.controls.newPassword.value
      ? this.i18n.t('auth.resetPassword.mismatch')
      : null;
  }

  protected isConnected(provider: LoginProvider): boolean {
    return this.user()?.provider === provider;
  }

  /** `AUTH-RULES.md` §2: смена пароля инвалидирует все сессии и уведомляет. */
  protected changePassword(): void {
    this.form.markAllAsTouched();
    const mismatch =
      this.form.controls.newPassword.value !== this.form.controls.confirmPassword.value;
    if (this.form.invalid || mismatch) {
      return;
    }

    this.auth.logout();
    this.toast.show('success', this.i18n.t('profile.changePassword.success'));
    this.router.navigateByUrl('/login');
  }

  protected confirmDelete(): void {
    const ref = this.modal.open(ConfirmDialog, {
      title: this.i18n.t('profile.deleteAccount.confirmTitle'),
      message: this.i18n.t('profile.deleteAccount.confirmMessage'),
      confirmLabel: this.i18n.t('profile.deleteAccount.confirmAction'),
      cancelLabel: this.i18n.t('profile.deleteAccount.cancel'),
      variant: 'danger',
      onConfirm: () => {
        ref.close();
        this.auth.logout();
        this.router.navigateByUrl('/');
      },
      onCancel: () => ref.close(),
    });
  }
}
