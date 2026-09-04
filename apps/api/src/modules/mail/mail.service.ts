import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { env } from '../../config/env';

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
}

/**
 * Обобщённая отправка почты — без auth-специфичного содержимого: тексты
 * писем восстановления пароля и т.п. пишет их собственная спека (009), там
 * же решается, что можно логировать в контексте письма с токеном, а что
 * нет. Здесь только транспорт. Локально — MailHog (`docker-compose.yml`),
 * в проде — любой SMTP через те же переменные окружения (`env.ts`),
 * конкретный провайдер не выбран (спека 017).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  /**
   * `auth` появляется только когда пара задана целиком. Локальный MailHog
   * принимает анонимно и на переданном `auth` отвечал бы ошибкой; провайдер
   * без `auth` отвергает отправку. Пару валидирует `env.ts` — здесь остаётся
   * выбор между двумя рабочими режимами, а не проверка (`INFRA-12`).
   */
  private readonly transporter: Transporter = createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER !== undefined && env.SMTP_PASSWORD !== undefined
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
  });

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: env.SMTP_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    // Получатель — не секрет (в отличие от темы/тела письма восстановления,
    // которые тут даже не видны — их формирует вызывающий код), факт
    // отправки нужен для отладки доставки.
    this.logger.log(`Mail sent to ${message.to}`);
  }
}
