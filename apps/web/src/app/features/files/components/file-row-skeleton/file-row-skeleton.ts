import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-file-row-skeleton',
  templateUrl: './file-row-skeleton.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileRowSkeleton {}
