/**
 * EmailAdapter — sends transactional emails via Resend (https://resend.com).
 *
 * Resend was chosen over SendGrid/SES for its developer experience and
 * generous free tier. Swapping providers means only this file changes.
 *
 * All emails are HTML templates rendered inline. We keep them in-process
 * (no separate template service) to avoid latency and keep them version-controlled.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NotificationChannelAdapter, NotificationPayload, NotificationResult } from '../notification-channel.interface';
import { renderEmailTemplate } from '../templates/email-templates';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EmailAdapter implements NotificationChannelAdapter {
  private readonly logger = new Logger(EmailAdapter.name);
  private readonly fromAddress: string;
  private readonly resendApiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.fromAddress = config.get('RESEND_FROM_ADDRESS', 'noreply@vidapartners.com.sg');
    this.resendApiKey = config.get('RESEND_API_KEY', '');
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    if (!this.resendApiKey) {
      this.logger.warn('RESEND_API_KEY not configured — email skipped');
      return { success: false, errorMessage: 'Email not configured' };
    }

    if (!payload.recipientEmail) {
      return { success: false, errorMessage: 'No recipient email provided' };
    }

    const html = renderEmailTemplate(payload);

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: payload.recipientEmail,
          subject: payload.title,
          html,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Resend HTTP ${response.status}: ${errBody}`);
      }

      const data: any = await response.json();

      // Persist in-app notification to DB for the notification centre
      await this.prisma.notification.create({
        data: {
          audience: payload.audience as any,
          adminUserId: payload.audience === 'ADMIN' ? payload.recipientId : null,
          customerId: payload.audience === 'CUSTOMER' ? payload.recipientId : null,
          branchId: payload.branchId,
          eventType: payload.eventType,
          title: payload.title,
          body: payload.body,
          actionUrl: payload.actionUrl,
          channel: 'EMAIL',
          status: 'SENT',
          severity: payload.severity ?? 'info',
          metadata: payload.metadata as any,
          sentAt: new Date(),
        },
      });

      return { success: true, externalId: data.id };
    } catch (err: any) {
      this.logger.error(`Resend send failed for ${payload.recipientEmail}: ${err.message}`);
      return { success: false, errorMessage: err.message };
    }
  }
}
