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
  private readonly transporter: Transporter = createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
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
