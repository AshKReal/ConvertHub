import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';

import { I18nService } from '../../../../core/services/i18n';

export type OauthProvider = 'google' | 'telegram';

/**
 * Визуально, без реального OAuth/HMAC (спека 019) — `chosen` только эмулирует
 * успешный вход тем же моком, что и форма. Настоящий поток — спека 008.
 *
 * Фирменные цвета Google/Telegram — точечное исключение из запрета HEX в
 * разметке (`AGENTS.md`): это чужой товарный знак, а не цвет нашего интерфейса,
 * перекрашивать его в токены `DESIGN.md` нельзя.
 */
@Component({
  selector: 'app-oauth-buttons',
  templateUrl: './oauth-buttons.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OauthButtons {
  protected readonly i18n = inject(I18nService);

  chosen = output<OauthProvider>();
}
