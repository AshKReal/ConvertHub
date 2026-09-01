import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import type { AppError } from '../../../../core/interceptors/error-interceptor';
import { I18nService } from '../../../../core/services/i18n';
import { ModalService } from '../../../../core/services/modal';
import { ToastService } from '../../../../core/services/toast';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { KeyRevealModal } from '../../components/key-reveal-modal/key-reveal-modal';
import { KeyRow } from '../../components/key-row/key-row';
import {
  injectApiKeysQuery,
  injectIssueApiKeyMutation,
  injectReissueApiKeyMutation,
  injectRevokeApiKeyMutation,
} from '../../data/api-keys.api';

/**
 * Спека 011. Мок-стор (`ApiKeysStore`, 022) удалён — TanStack Query даёт
 * сигналы состояния сам (`ARCHITECTURE.md` §6.2), как и `/files` (010).
 * Полное значение ключа приходит из ответа мутации, не создаётся на клиенте.
 */
@Component({
  selector: 'app-api-keys-page',
  imports: [Button, KeyRow],
  templateUrl: './api-keys-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiKeysPage {
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);

  private readonly query = injectApiKeysQuery();
  protected readonly issueMutation = injectIssueApiKeyMutation();
  private readonly reissueMutation = injectReissueApiKeyMutation();
  private readonly revokeMutation = injectRevokeApiKeyMutation();

  protected readonly keys = computed(() => this.query.data()?.items ?? []);
  /** Первая загрузка — не показываем ни список, ни пустое состояние, чтобы «ключей нет» не мигало. */
  protected readonly loading = computed(() => this.query.isPending());

  protected issueKey(): void {
    if (this.issueMutation.isPending()) {
      return;
    }
    this.issueMutation.mutate(undefined, {
      onSuccess: (issued) => this.openReveal(issued.fullValue),
      onError: (error: AppError) => this.toast.show('danger', error.message),
    });
  }

  protected reissueKey(id: string): void {
    const ref = this.modal.open(ConfirmDialog, {
      title: this.i18n.t('apiKeys.reissueConfirm.title'),
      message: this.i18n.t('apiKeys.reissueConfirm.message'),
      confirmLabel: this.i18n.t('apiKeys.reissueConfirm.confirm'),
      cancelLabel: this.i18n.t('apiKeys.reissueConfirm.cancel'),
      variant: 'primary',
      onConfirm: () => {
        ref.close();
        this.reissueMutation.mutate(id, {
          onSuccess: (issued) => this.openReveal(issued.fullValue),
          onError: (error: AppError) => this.toast.show('danger', error.message),
        });
      },
      onCancel: () => ref.close(),
    });
  }

  protected revokeKey(id: string): void {
    const ref = this.modal.open(ConfirmDialog, {
      title: this.i18n.t('apiKeys.revokeConfirm.title'),
      message: this.i18n.t('apiKeys.revokeConfirm.message'),
      confirmLabel: this.i18n.t('apiKeys.revokeConfirm.confirm'),
      cancelLabel: this.i18n.t('apiKeys.revokeConfirm.cancel'),
      variant: 'danger',
      onConfirm: () => {
        ref.close();
        this.revokeMutation.mutate(id, {
          onSuccess: () => this.toast.show('success', this.i18n.t('apiKeys.revokeConfirm.success')),
          onError: (error: AppError) => this.toast.show('danger', error.message),
        });
      },
      onCancel: () => ref.close(),
    });
  }

  private openReveal(fullValue: string): void {
    const ref = this.modal.open(KeyRevealModal, {
      fullKey: fullValue,
      onClose: () => ref.close(),
    });
  }
}
