import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Не подключён в `AppModule` — пока ни один эндпоинт не отправляет письма.
 * Модуль и сервис — инфраструктурная просьба владельца, сделана заранее и
 * отдельно от 🔒 auth-логики восстановления пароля (009 её и подключит,
 * через `imports: [MailModule]` в своём модуле, когда появится первый
 * реальный вызов `MailService.send()`).
 */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
