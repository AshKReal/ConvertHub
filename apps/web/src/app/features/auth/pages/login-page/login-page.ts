import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import type { AppError } from '../../../../core/interceptors/error-interceptor';
import { AuthService } from '../../../../core/services/auth';
import { I18nService } from '../../../../core/services/i18n';
import { ToastService } from '../../../../core/services/toast';
import { Button } from '../../../../shared/ui/button/button';
import { Input } from '../../../../shared/ui/input/input';
import { OauthButtons, type OauthProvider } from '../../components/oauth-buttons/oauth-buttons';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, Button, Input, OauthButtons],
  templateUrl: './login-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly showError = signal(false);
  /** Против двойного клика: реальный запрос, не мок — второй клик до ответа первого не должен слать второй. */
  protected readonly submitting = signal(false);

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
    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.showError.set(false);
    this.submitting.set(true);
    this.auth.login(this.form.controls.email.value, this.form.controls.password.value).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (error: AppError) => {
        this.submitting.set(false);
        // Единое сообщение под формой (AUTH-RULES.md §2) — прочие коды
        // (rate limit и т.п.) тостом, как решено для остальных отказов (026).
        if (error.code === 'INVALID_CREDENTIALS') {
          this.showError.set(true);
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
