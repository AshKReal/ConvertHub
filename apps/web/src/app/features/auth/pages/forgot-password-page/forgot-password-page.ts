import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../../core/services/i18n';
import { Button } from '../../../../shared/ui/button/button';
import { Input } from '../../../../shared/ui/input/input';

@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink, Button, Input],
  templateUrl: './forgot-password-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPage {
  protected readonly i18n = inject(I18nService);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  /**
   * Один и тот же результат независимо от существования аккаунта
   * (`TECH-SPEC.md` §8.5) — мок соблюдает инвариант заранее, реальный
   * запрос и одноразовый токен появятся в 009.
   */
  protected readonly submitted = signal(false);

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
    if (this.form.invalid) {
      return;
    }

    this.submitted.set(true);
  }
}
