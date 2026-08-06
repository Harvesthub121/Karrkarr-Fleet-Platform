import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import { EmailAdapter } from './adapters/email.adapter';
import { InAppAdapter } from './adapters/in-app.adapter';
import { WhatsAppAdapter } from './adapters/whatsapp.adapter';
import { SmsAdapter } from './adapters/sms.adapter';
import { PushAdapter } from './adapters/push.adapter';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    EmailAdapter,
    InAppAdapter,
    WhatsAppAdapter,
    SmsAdapter,
    PushAdapter,
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
