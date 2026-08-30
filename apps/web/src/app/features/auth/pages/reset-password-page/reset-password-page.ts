import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MIN_PASSWORD_LENGTH } from '@convert-hub/shared';

import type { AppError } from '../../../../core/interceptors/error-interceptor';
import { AuthService } from '../../../../core/services/auth';
import { I18nService } from '../../../../core/services/i18n';
import { ToastService } from '../../../../core/services/toast';
import { Button } from '../../../../shared/ui/button/button';
import { Input } from '../../../../shared/ui/input/input';

type Phase = 'form' | 'success' | 'invalid';

/** Токен из `/reset-password/:token` — читается из URL, отправляется на сервер как есть, не парсится тут. */
@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink, Button, Input],
  templateUrl: './reset-password-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);

  private readonly token = this.route.snapshot.paramMap.get('token') ?? '';

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

  protected readonly phase = signal<Phase>('form');
  protected readonly submitting = signal(false);

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
    if (this.form.invalid || mismatch || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.auth.resetPassword(this.token, this.form.controls.password.value).subscribe({
      next: () => {
        this.submitting.set(false);
        this.phase.set('success');
      },
      error: (error: AppError) => {
        this.submitting.set(false);
        // `INVALID_RESET_TOKEN` — отдельный экран, не инлайн-ошибка формы:
        // проблема не в том, что ввёл пользователь, а в самой ссылке. Любой
        // другой код (rate limit и т.п.) — тостом, форма остаётся: ссылка
        // может быть в полном порядке, показывать «недействительна» было бы враньём.
        if (error.code === 'INVALID_RESET_TOKEN') {
          this.phase.set('invalid');
        } else {
          this.toast.show('danger', error.message);
        }
      },
    });
  }
}
