import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MAX_NAME_LENGTH, MIN_PASSWORD_LENGTH } from '@convert-hub/shared';

import type { AppError } from '../../../../core/interceptors/error-interceptor';
import { AuthService } from '../../../../core/services/auth';
import { I18nService } from '../../../../core/services/i18n';
import { ToastService } from '../../../../core/services/toast';
import { Button } from '../../../../shared/ui/button/button';
import { Input } from '../../../../shared/ui/input/input';
import { OauthButtons } from '../../components/oauth-buttons/oauth-buttons';

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
    // Спека 029. Обязательны — решение владельца. `maxLength` совпадает с
    // серверной схемой (`MAX_NAME_LENGTH`, packages/shared): одно число,
    // подсказка в форме и валидация на сервере читают его же.
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NAME_LENGTH)],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NAME_LENGTH)],
    }),
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

  protected nameError(control: FormControl<string>): string | null {
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required')
      ? this.i18n.t('auth.error.nameRequired')
      : this.i18n.t('auth.error.nameTooLong', { max: MAX_NAME_LENGTH });
  }

  protected get firstNameError(): string | null {
    return this.nameError(this.form.controls.firstName);
  }

  protected get lastNameError(): string | null {
    return this.nameError(this.form.controls.lastName);
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
      .register({
        email: this.form.controls.email.value,
        password: this.form.controls.password.value,
        firstName: this.form.controls.firstName.value,
        lastName: this.form.controls.lastName.value,
      })
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
}
