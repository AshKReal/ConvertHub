import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService, type LoginProvider } from '../../../../core/services/auth';
import { I18nService } from '../../../../core/services/i18n';
import { MIN_PASSWORD_LENGTH } from '@convert-hub/shared';
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
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required')
      ? this.i18n.t('auth.error.passwordRequired')
      : this.i18n.t('auth.error.passwordTooShort', { min: MIN_PASSWORD_LENGTH });
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    this.register(this.form.controls.email.value);
  }

  protected onOauth(provider: OauthProvider): void {
    this.register('demo@convert-hub.io', provider);
  }

  private register(email: string, provider: LoginProvider = 'password'): void {
    this.auth.login(email, provider);
    this.router.navigateByUrl('/');
  }
}
