import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AuthService } from '../../../../core/services/auth';
import { I18nService } from '../../../../core/services/i18n';

/**
 * Google — полная навигация браузера (`<a href>` на `AuthService.googleStartUrl()`,
 * спека 008), не эмуляция: колбэк отвечает редиректом с уже установленной
 * сессией, страница просто грузится заново.
 *
 * Кнопки Telegram больше нет, и `chosen` вместе с ней: она была визуальной
 * заглушкой (019), которая ставила сессию без токена прямо в сигнал, минуя
 * сервер. Единственный провайдер — Google, поэтому компонент теперь ничего
 * не эмитит наружу, а страницам входа и регистрации нечего обрабатывать.
 *
 * Фирменные цвета Google — точечное исключение из запрета HEX в разметке
 * (`AGENTS.md`): это чужой товарный знак, а не цвет нашего интерфейса,
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
}
