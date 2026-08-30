import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import type { AppError } from '../../../../core/interceptors/error-interceptor';
import { AuthService } from '../../../../core/services/auth';
import { I18nService } from '../../../../core/services/i18n';
import { ToastService } from '../../../../core/services/toast';
import { Button } from '../../../../shared/ui/button/button';
import { Input } from '../../../../shared/ui/input/input';

@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink, Button, Input],
  templateUrl: './forgot-password-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  /**
   * Один и тот же результат независимо от существования аккаунта
   * (`TECH-SPEC.md` §8.5) — сервер отвечает `200` в обоих случаях, `next`
   * ниже не различает их и не может: тела ответа для этого не хватает
   * намеренно.
   */
  protected readonly submitted = signal(false);
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

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.auth.requestPasswordReset(this.form.controls.email.value).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
      // Сюда попадает не «аккаунт не найден» (сервер такого не говорит),
      // а инфраструктурные отказы — rate limit и т.п.
      error: (error: AppError) => {
        this.submitting.set(false);
        this.toast.show('danger', error.message);
      },
    });
  }
}
