import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-format-card',
  templateUrl: './format-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormatCard {
  from = input.required<string>();
  to = input.required<string>();
  description = input.required<string>();
}
