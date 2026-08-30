import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import type { AppError } from '../../../../core/interceptors/error-interceptor';
import { AuthService } from '../../../../core/services/auth';
import { I18nService } from '../../../../core/services/i18n';
import { LOGIN_PROVIDER_LABEL_KEYS } from '../../../../core/i18n/messages';
import { ModalService } from '../../../../core/services/modal';
import { ToastService } from '../../../../core/services/toast';
import { MIN_PASSWORD_LENGTH } from '@convert-hub/shared';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Input } from '../../../../shared/ui/input/input';

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule, RouterLink, Button, Input],
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

  protected readonly wrongCurrentPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly deleting = signal(false);
  protected readonly unlinking = signal(false);

  protected get currentPasswordError(): string | null {
    // Серверная ошибка в том же слоте, что клиентская валидация — тот же
    // приём, что `emailTaken` в `register-page.ts` (007).
    if (this.wrongCurrentPassword()) {
      return this.i18n.t('profile.changePassword.wrongCurrent');
    }
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

  /** Спека 008. Реальный список привязанных способов входа — не единственный метод текущей сессии, как в 020. */
  protected hasPassword(): boolean {
    return this.user()?.hasPassword ?? false;
  }

  protected isGoogleLinked(): boolean {
    return this.user()?.providers.includes('google') ?? false;
  }

  /**
   * Тот же расчёт, что серверный `AuthService.unlinkIdentity` (`AUTH-RULES.md`:
   * запрет отвязки последнего способа входа) — предупреждает до запроса
   * (кнопка задизейблена), не только после отказа сервера.
   */
  protected canUnlinkGoogle(): boolean {
    const current = this.user();
    if (current === null) {
      return false;
    }
    const remainingAfterUnlink = (current.hasPassword ? 1 : 0) + (current.providers.length - 1);
    return remainingAfterUnlink > 0;
  }

  protected unlinkGoogle(): void {
    if (this.unlinking() || !this.canUnlinkGoogle()) {
      return;
    }
    this.unlinking.set(true);
    this.auth.unlinkIdentity('google').subscribe({
      next: () => this.unlinking.set(false),
      error: (error: AppError) => {
        this.unlinking.set(false);
        // LAST_LOGIN_METHOD сюда обычно не должен доходить — кнопка уже
        // задизейблена `canUnlinkGoogle()`; если всё же гонка (второй способ
        // входа отвязан параллельно в другой вкладке), тот же текст, что
        // тултип disabled-кнопки (ERROR_MESSAGE_KEYS, core/i18n/messages.ts).
        this.toast.show('danger', error.message);
      },
    });
  }

  /** `AUTH-RULES.md` §2: смена пароля инвалидирует все сессии и уведомляет — сервер уже сделал это на успехе. */
  protected changePassword(): void {
    this.form.markAllAsTouched();
    const mismatch =
      this.form.controls.newPassword.value !== this.form.controls.confirmPassword.value;
    if (this.form.invalid || mismatch || this.submitting()) {
      return;
    }

    this.wrongCurrentPassword.set(false);
    this.submitting.set(true);
    this.auth
      .changePassword(
        this.form.controls.currentPassword.value,
        this.form.controls.newPassword.value,
      )
      .subscribe({
        next: () => {
          // Сервер уже отозвал все сессии — `logout()` здесь только сбрасывает
          // локальное состояние (`AuthService`), сам HTTP-вызов, который он
          // заодно делает, действует на уже мёртвую сессию, безвредно.
          this.auth.logout();
          this.toast.show('success', this.i18n.t('profile.changePassword.success'));
          this.router.navigateByUrl('/login');
        },
        error: (error: AppError) => {
          this.submitting.set(false);
          if (error.code === 'INVALID_CREDENTIALS') {
            this.wrongCurrentPassword.set(true);
          } else {
            this.toast.show('danger', error.message);
          }
        },
      });
  }

  protected confirmDelete(): void {
    const ref = this.modal.open(ConfirmDialog, {
      title: this.i18n.t('profile.deleteAccount.confirmTitle'),
      message: this.i18n.t('profile.deleteAccount.confirmMessage'),
      confirmLabel: this.i18n.t('profile.deleteAccount.confirmAction'),
      cancelLabel: this.i18n.t('profile.deleteAccount.cancel'),
      variant: 'danger',
      onConfirm: () => {
        if (this.deleting()) {
          return;
        }
        this.deleting.set(true);
        this.auth.deleteAccount().subscribe({
          next: () => {
            ref.close();
            this.router.navigateByUrl('/');
          },
          error: (error: AppError) => {
            this.deleting.set(false);
            ref.close();
            this.toast.show('danger', error.message);
          },
        });
      },
      onCancel: () => ref.close(),
    });
  }
}
