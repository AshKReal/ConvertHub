import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/services/auth';
import { I18nService } from '../../../../core/services/i18n';
import { Button } from '../../../../shared/ui/button/button';
import { Input } from '../../../../shared/ui/input/input';
import { OauthButtons } from '../../components/oauth-buttons/oauth-buttons';

/**
 * Мок для ручной приёмки: переключить на `false`, чтобы увидеть единое
 * сообщение об ошибке входа (`AUTH-RULES.md`: одно сообщение на любую причину
 * отказа). Настоящая проверка учётных данных — бэкенд, спека 007.
 */
const MOCK_LOGIN_SUCCEEDS = true;

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, Button, Input, OauthButtons],
  templateUrl: './login-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly showError = signal(false);

  protected get emailError(): string | null {
    const control = this.form.controls.email;
    if (!control.touched || control.valid) {
      return null;
    }
    return this.i18n.t(
      control.hasError('required') ? 'auth.error.emailRequired' : 'auth.error.emailInvalid',
    );
  }

  protected get passwordError(): string | null {
    const control = this.form.controls.password;
    return control.touched && control.hasError('required')
      ? this.i18n.t('auth.error.passwordRequired')
      : null;
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    this.tryLogin(this.form.controls.email.value);
  }

  protected onOauth(): void {
    this.tryLogin('demo@convert-hub.io');
  }

  private tryLogin(email: string): void {
    if (!MOCK_LOGIN_SUCCEEDS) {
      this.showError.set(true);
      return;
    }

    this.showError.set(false);
    this.auth.login(email);
    this.router.navigateByUrl('/');
  }
}
