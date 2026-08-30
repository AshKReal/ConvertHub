import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type FileTypeIconCategory = 'image' | 'document' | 'document-with-lines';

@Component({
  selector: 'app-file-type-icon',
  templateUrl: './file-type-icon.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileTypeIcon {
  category = input.required<FileTypeIconCategory>();
}
