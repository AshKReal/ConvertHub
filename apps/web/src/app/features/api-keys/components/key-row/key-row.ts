import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '../../../../core/services/i18n';
import { maskedDisplay } from '../../data/api-keys.mock';
import type { ApiKey } from '../../model/api-key';

@Component({
  selector: 'app-key-row',
  templateUrl: './key-row.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeyRow {
  protected readonly i18n = inject(I18nService);

  key = input.required<ApiKey>();
  reissue = output<void>();
  revoke = output<void>();

  protected readonly maskedValue = computed(() => maskedDisplay(this.key().maskedPrefix));

  protected readonly createdLabel = computed(() =>
    this.i18n.t('apiKeys.row.created', { date: this.i18n.formatDate(this.key().createdAt) }),
  );

  protected readonly lastUsedLabel = computed(() => {
    const lastUsedAt = this.key().lastUsedAt;
    return lastUsedAt === null
      ? this.i18n.t('apiKeys.row.neverUsed')
      : this.i18n.t('apiKeys.row.lastUsed', { date: this.i18n.formatDate(lastUsedAt) });
  });
}
