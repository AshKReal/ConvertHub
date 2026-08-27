import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { I18nService } from '../../../../core/services/i18n';
import { ModalService } from '../../../../core/services/modal';
import { ToastService } from '../../../../core/services/toast';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { KeyRevealModal } from '../../components/key-reveal-modal/key-reveal-modal';
import { KeyRow } from '../../components/key-row/key-row';
import { ApiKeysStore } from '../../data/api-keys.store';

@Component({
  selector: 'app-api-keys-page',
  imports: [Button, KeyRow],
  providers: [ApiKeysStore],
  templateUrl: './api-keys-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiKeysPage {
  private readonly store = inject(ApiKeysStore);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);

  protected readonly keys = this.store.keys;

  protected issueKey(): void {
    this.openReveal(this.store.issue());
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
        const fullValue = this.store.reissue(id);
        if (fullValue !== undefined) {
          this.openReveal(fullValue);
        }
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
        this.store.revoke(id);
        this.toast.show('success', this.i18n.t('apiKeys.revokeConfirm.success'));
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
