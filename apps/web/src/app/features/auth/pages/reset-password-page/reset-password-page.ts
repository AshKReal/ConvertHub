import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../../core/services/i18n';
import { MIN_PASSWORD_LENGTH } from '../../../../shared/constants/password-policy';
import { Button } from '../../../../shared/ui/button/button';
import { Input } from '../../../../shared/ui/input/input';

/**
 * Токен из `/reset-password/:token` — заглушка, не проверяется: маршрут
 * совпадает при любом значении. Настоящая проверка (TTL, одноразовость) — 009.
 */
@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink, Button, Input],
  templateUrl: './reset-password-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  protected readonly i18n = inject(I18nService);

  protected readonly form = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)],
    }),
    confirm: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected readonly submitted = signal(false);

  protected get passwordError(): string | null {
    const control = this.form.controls.password;
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required')
      ? this.i18n.t('auth.error.passwordRequired')
      : this.i18n.t('auth.error.passwordTooShort', { min: MIN_PASSWORD_LENGTH });
  }

  protected get confirmError(): string | null {
    const control = this.form.controls.confirm;
    if (!control.touched) {
      return null;
    }
    if (control.hasError('required')) {
      return this.i18n.t('auth.error.passwordRequired');
    }
    return control.value !== this.form.controls.password.value
      ? this.i18n.t('auth.resetPassword.mismatch')
      : null;
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    const mismatch = this.form.controls.password.value !== this.form.controls.confirm.value;
    if (this.form.invalid || mismatch) {
      return;
    }

    this.submitted.set(true);
  }
}
