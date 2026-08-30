import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MIN_PASSWORD_LENGTH } from '@convert-hub/shared';

import type { AppError } from '../../../../core/interceptors/error-interceptor';
import { AuthService } from '../../../../core/services/auth';
import { I18nService } from '../../../../core/services/i18n';
import { ToastService } from '../../../../core/services/toast';
import { Button } from '../../../../shared/ui/button/button';
import { Input } from '../../../../shared/ui/input/input';
import { OauthButtons, type OauthProvider } from '../../components/oauth-buttons/oauth-buttons';

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink, Button, Input, OauthButtons],
  templateUrl: './register-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)],
    }),
  });

  protected readonly emailTaken = signal(false);
  protected readonly submitting = signal(false);

  protected get emailError(): string | null {
    // Серверная ошибка (email занят) в том же слоте, что клиентская
    // валидация — `app-input` показывает одно сообщение под полем, не два.
    if (this.emailTaken()) {
      return this.i18n.t('auth.error.emailTaken');
    }
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
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required')
      ? this.i18n.t('auth.error.passwordRequired')
      : this.i18n.t('auth.error.passwordTooShort', { min: MIN_PASSWORD_LENGTH });
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.emailTaken.set(false);
    this.submitting.set(true);
    this.auth
      .register(this.form.controls.email.value, this.form.controls.password.value)
      .subscribe({
        next: () => this.router.navigateByUrl('/'),
        error: (error: AppError) => {
          this.submitting.set(false);
          if (error.code === 'EMAIL_ALREADY_REGISTERED') {
            this.emailTaken.set(true);
          } else {
            this.toast.show('danger', error.message);
          }
        },
      });
  }

  protected onOauth(provider: OauthProvider): void {
    this.auth.loginAsMockOAuth('demo@convert-hub.io', provider);
    this.router.navigateByUrl('/');
  }
}
