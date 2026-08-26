import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type FormControl, ReactiveFormsModule } from '@angular/forms';

export type InputType = 'text' | 'email' | 'password';

@Component({
  selector: 'app-input',
  imports: [ReactiveFormsModule],
  templateUrl: './input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Input {
  fieldId = input.required<string>();
  label = input.required<string>();
  type = input<InputType>('text');
  control = input.required<FormControl<string>>();
  errorMessage = input<string | null>(null);
  autocomplete = input<string>('off');

  protected readonly describedBy = computed(() =>
    this.errorMessage() === null ? null : `${this.fieldId()}-error`,
  );
}
