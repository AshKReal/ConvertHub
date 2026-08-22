import { ChangeDetectionStrategy, Component } from '@angular/core';

import { FormatCard, FormatCardIcon } from '../../../../shared/ui/format-card/format-card';

interface ConversionDirection {
  from: string;
  to: string;
  description: string;
  icon: FormatCardIcon;
}

const CONVERSION_DIRECTIONS: readonly ConversionDirection[] = [
  { from: 'JPG', to: 'PNG', description: 'Прозрачный фон, без потери качества', icon: 'image' },
  { from: 'PNG', to: 'JPG', description: 'Меньше размер файла, настраиваемое качество', icon: 'image' },
  { from: 'DOCX', to: 'PDF', description: 'Готово к печати и отправке, вёрстка сохранена', icon: 'document-lines' },
  { from: 'PDF', to: 'JPG', description: 'Постранично, с выбором разрешения', icon: 'document' },
];

@Component({
  selector: 'app-home-page',
  imports: [FormatCard],
  templateUrl: './home-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly directions = CONVERSION_DIRECTIONS;
}
