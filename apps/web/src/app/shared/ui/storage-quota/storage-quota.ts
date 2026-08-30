import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const WARNING_THRESHOLD_PERCENT = 80;

@Component({
  selector: 'app-storage-quota',
  templateUrl: './storage-quota.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorageQuota {
  usedBytes = input.required<number>();
  totalBytes = input.required<number>();
  label = input.required<string>();

  protected readonly percent = computed(() => {
    const total = this.totalBytes();
    return total <= 0 ? 0 : Math.min(100, (this.usedBytes() / total) * 100);
  });

  protected readonly barClass = computed(() => {
    const percent = this.percent();
    if (percent >= 100) {
      return 'bg-danger';
    }
    return percent >= WARNING_THRESHOLD_PERCENT ? 'bg-warning' : 'bg-accent-hover';
  });
}
