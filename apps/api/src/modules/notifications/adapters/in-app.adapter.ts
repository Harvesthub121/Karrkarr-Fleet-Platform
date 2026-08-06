/**
 * InAppAdapter — persists notifications to the Notification table.
 * The notification centre endpoints query this table directly.
 */

import { Injectable } from '@nestjs/common';
import type { NotificationChannelAdapter, NotificationPayload, NotificationResult } from '../notification-channel.interface';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class InAppAdapter implements NotificationChannelAdapter {
  constructor(private readonly prisma: PrismaService) {}

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          audience: payload.audience as any,
          adminUserId: payload.audience === 'ADMIN' ? payload.recipientId : null,
          customerId: payload.audience === 'CUSTOMER' ? payload.recipientId : null,
          branchId: payload.branchId,
          eventType: payload.eventType,
          title: payload.title,
          body: payload.body,
          actionUrl: payload.actionUrl,
          channel: 'IN_APP',
          status: 'SENT',
          severity: payload.severity ?? 'info',
          metadata: payload.metadata as any,
          sentAt: new Date(),
        },
        select: { id: true },
      });
      return { success: true, externalId: notification.id };
    } catch (err: any) {
      return { success: false, errorMessage: err.message };
    }
  }
}
