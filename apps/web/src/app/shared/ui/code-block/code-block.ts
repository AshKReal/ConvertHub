import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-code-block',
  templateUrl: './code-block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeBlock {
  code = input.required<string>();
}
