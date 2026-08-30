import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';

import { AuthService } from '../../../../core/services/auth';
import { I18nService } from '../../../../core/services/i18n';

/** Спека 008. Единственный оставшийся мок-провайдер — Google теперь реальная навигация, не `chosen`. */
export type MockOauthProvider = 'telegram';

/**
 * Google — полная навигация браузера (`<a href>` на `AuthService.googleStartUrl()`,
 * спека 008), не эмуляция: колбэк отвечает редиректом с уже установленной
 * сессией, страница просто грузится заново. Telegram остаётся визуальной
 * заглушкой (019) — настоящий поток ждёт отдельного номера спеки
 * (`AUTH-RULES.md` §5), `chosen` эмулирует успешный вход тем же моком, что форма.
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
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  chosen = output<MockOauthProvider>();
}
