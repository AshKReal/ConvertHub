import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import type { AppError } from '../../../../core/interceptors/error-interceptor';
import { AuthService } from '../../../../core/services/auth';
import { I18nService } from '../../../../core/services/i18n';
import { LOGIN_PROVIDER_LABEL_KEYS } from '../../../../core/i18n/messages';
import { ModalService } from '../../../../core/services/modal';
import { ToastService } from '../../../../core/services/toast';
import { MAX_AVATAR_SIZE_BYTES, MAX_NAME_LENGTH, MIN_PASSWORD_LENGTH } from '@convert-hub/shared';
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

  /**
   * Спека 029. Начальные значения из сигнала сессии: страница за `authGuard`,
   * поэтому на момент создания компонента пользователь уже есть. `?? ''` —
   * аккаунт, созданный до 029: имени нет, поля пустые.
   */
  protected readonly nameForm = new FormGroup({
    firstName: new FormControl(this.auth.user()?.firstName ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NAME_LENGTH)],
    }),
    lastName: new FormControl(this.auth.user()?.lastName ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NAME_LENGTH)],
    }),
  });

  protected readonly savingName = signal(false);
  protected readonly avatarBusy = signal(false);
  protected readonly maxAvatarSize = MAX_AVATAR_SIZE_BYTES;

  /**
   * Спека 029. Клиентская проверка размера — не замена серверной, а способ не
   * гнать заведомо отвергнутые два мегабайта по сети (тот же приём, что
   * `dropzone` применяет к `MAX_FILE_SIZE_BYTES`). Тип не проверяем: сервер
   * определяет его по сигнатуре, и `accept` в диалоге — подсказка, не гарантия.
   */
  protected onAvatarPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Диалог закрыли без выбора — не ошибка, просто нечего делать.
    if (file === undefined || this.avatarBusy()) {
      return;
    }
    // Сбрасываем сразу: без этого повторный выбор ТОГО ЖЕ файла не даст
    // события `change`, и «попробовать ещё раз» после ошибки не сработает.
    input.value = '';

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      this.toast.show(
        'danger',
        this.i18n.t('profile.avatar.tooLarge', {
          max: this.i18n.formatBytes(MAX_AVATAR_SIZE_BYTES),
        }),
      );
      return;
    }

    this.avatarBusy.set(true);
    this.auth.uploadAvatar(file).subscribe({
      next: () => {
        this.avatarBusy.set(false);
        this.toast.show('success', this.i18n.t('profile.avatar.uploaded'));
      },
      error: (error: AppError) => {
        this.avatarBusy.set(false);
        this.toast.show('danger', error.message);
      },
    });
  }

  protected removeAvatar(): void {
    if (this.avatarBusy()) {
      return;
    }
    this.avatarBusy.set(true);
    this.auth.removeAvatar().subscribe({
      next: () => this.avatarBusy.set(false),
      error: (error: AppError) => {
        this.avatarBusy.set(false);
        this.toast.show('danger', error.message);
      },
    });
  }

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

  protected nameError(control: FormControl<string>): string | null {
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required')
      ? this.i18n.t('auth.error.nameRequired')
      : this.i18n.t('auth.error.nameTooLong', { max: MAX_NAME_LENGTH });
  }

  protected get firstNameError(): string | null {
    return this.nameError(this.nameForm.controls.firstName);
  }

  protected get lastNameError(): string | null {
    return this.nameError(this.nameForm.controls.lastName);
  }

  /** Спека 029. Сессия не отзывается — имя не способ входа (`docs/AUTH.md`). */
  protected saveName(): void {
    this.nameForm.markAllAsTouched();
    if (this.nameForm.invalid || this.savingName()) {
      return;
    }

    this.savingName.set(true);
    this.auth
      .updateProfile({
        firstName: this.nameForm.controls.firstName.value,
        lastName: this.nameForm.controls.lastName.value,
      })
      .subscribe({
        next: () => {
          this.savingName.set(false);
          this.toast.show('success', this.i18n.t('profile.name.success'));
        },
        error: (error: AppError) => {
          this.savingName.set(false);
          this.toast.show('danger', error.message);
        },
      });
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
