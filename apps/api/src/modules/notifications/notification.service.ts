/**
 * NotificationService — channel-agnostic fan-out with a pluggable adapter model.
 *
 * Architecture:
 *   NotificationChannelAdapter defines the contract.
 *   EmailAdapter (Resend) and InAppAdapter are fully implemented.
 *   WhatsAppAdapter, SmsAdapter, PushAdapter throw NotImplemented with
 *   explicit wiring comments — exactly the "WhatsApp-ready architecture" brief.
 *
 * Admin fan-out respects branch scope: a branch-scoped admin only receives
 * events for their own branch; SUPER_ADMIN and head-office roles see all.
 */

import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationAudience } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailAdapter } from './adapters/email.adapter';
import { InAppAdapter } from './adapters/in-app.adapter';
import { WhatsAppAdapter } from './adapters/whatsapp.adapter';
import { SmsAdapter } from './adapters/sms.adapter';
import { PushAdapter } from './adapters/push.adapter';
import { NotificationChannelAdapter, NotificationPayload } from './notification-channel.interface';

export interface FanOutToAdminsInput {
  branchId?: string;
  eventType: string;
  title: string;
  body: string;
  actionUrl?: string;
  severity?: string;
  metadata?: Record<string, unknown>;
}

export interface NotifyCustomerInput {
  customerId: string;
  eventType: string;
  title: string;
  body: string;
  actionUrl?: string;
  severity?: string;
  metadata?: Record<string, unknown>;
}

// All 10 admin notification event types from the brief
export const ADMIN_EVENT_TYPES = [
  'payment.submitted',         // Customer submitted a payment claim
  'payment.approved',          // Admin approved a payment (for audit trail)
  'payment.rejected',          // Admin rejected a payment
  'invoice.overdue',           // Invoice transitioned to OVERDUE
  'vehicle.coe_expiring',      // COE within reminder ladder
  'vehicle.road_tax_expiring', // Road tax within reminder ladder
  'vehicle.insurance_expiring',// Insurance within reminder ladder
  'vehicle.inspection_due',    // Inspection within reminder ladder
  'rental.ending_soon',        // Rental entering ENDING_SOON state
  'risk.customer_high',        // Customer risk score crossed critical threshold
] as const;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  private readonly adapters: Record<NotificationChannel, NotificationChannelAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailAdapter,
    private readonly inApp: InAppAdapter,
    private readonly whatsapp: WhatsAppAdapter,
    private readonly sms: SmsAdapter,
    private readonly push: PushAdapter,
  ) {
    this.adapters = {
      EMAIL: email,
      IN_APP: inApp,
      WHATSAPP: whatsapp,
      SMS: sms,
      PUSH: push,
    };
  }

  /**
   * Fan out an admin notification to all admins in scope.
   * Branch-scoped admins only receive events for their own branch.
   * SUPER_ADMIN and admins with branchId=null receive all events.
   */
  async fanOutToAdmins(input: FanOutToAdminsInput): Promise<void> {
    const admins = await this.prisma.adminUser.findMany({
      where: {
        isActive: true,
        OR: [
          { branchId: null },           // head-office / SUPER_ADMIN
          { branchId: input.branchId }, // branch-scoped, matching branch
        ],
      },
      select: { id: true, email: true, fullName: true, role: true },
    });

    for (const admin of admins) {
      try {
        // Always write in-app notification
        await this.inApp.send({
          audience: 'ADMIN',
          recipientId: admin.id,
          eventType: input.eventType,
          title: input.title,
          body: input.body,
          actionUrl: input.actionUrl,
          severity: input.severity ?? 'info',
          metadata: input.metadata,
          branchId: input.branchId,
        });

        // Email for significant events
        if (this.shouldEmailAdmin(input.eventType)) {
          await this.email.send({
            audience: 'ADMIN',
            recipientId: admin.id,
            recipientEmail: admin.email,
            recipientName: admin.fullName,
            eventType: input.eventType,
            title: input.title,
            body: input.body,
            actionUrl: input.actionUrl,
            severity: input.severity ?? 'info',
            metadata: input.metadata,
          }).catch((err) => {
            // Log email failure but don't block in-app delivery
            this.logger.error(`Email failed for admin ${admin.id}: ${err.message}`);
          });
        }
      } catch (err: any) {
        this.logger.error(`Notification failed for admin ${admin.id}: ${err.message}`);
      }
    }
  }

  async notifyCustomer(input: NotifyCustomerInput): Promise<void> {
    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: input.customerId },
      select: { id: true, email: true, fullName: true },
    });

    await this.inApp.send({
      audience: 'CUSTOMER',
      recipientId: customer.id,
      eventType: input.eventType,
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl,
      severity: input.severity ?? 'info',
      metadata: input.metadata,
    });

    await this.email.send({
      audience: 'CUSTOMER',
      recipientId: customer.id,
      recipientEmail: customer.email,
      recipientName: customer.fullName,
      eventType: input.eventType,
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl,
      severity: input.severity ?? 'info',
      metadata: input.metadata,
    }).catch((err) => {
      this.logger.error(`Customer email failed for ${customer.id}: ${err.message}`);
    });
  }

  /** Send via a specific channel to a specific recipient. Used by jobs. */
  async send(
    channel: NotificationChannel,
    payload: NotificationPayload,
  ): Promise<void> {
    const adapter = this.adapters[channel];
    if (!adapter) {
      throw new Error(`No adapter registered for channel ${channel}`);
    }
    await adapter.send(payload);
  }

  private shouldEmailAdmin(eventType: string): boolean {
    // High-urgency events always email; informational events only in-app
    const alwaysEmail = [
      'payment.submitted',
      'vehicle.coe_expiring',
      'vehicle.insurance_expiring',
      'risk.customer_high',
    ];
    return alwaysEmail.includes(eventType);
  }

  /** List notifications for a recipient (admin or customer). */
  async list(
    audience: NotificationAudience,
    recipientId: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    const where =
      audience === 'ADMIN'
        ? { adminUserId: recipientId }
        : { customerId: recipientId };

    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  async markRead(notificationId: string, recipientId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        OR: [{ adminUserId: recipientId }, { customerId: recipientId }],
      },
      data: { status: 'READ', readAt: new Date() },
    });
  }

  async unreadCount(audience: NotificationAudience, recipientId: string): Promise<number> {
    const where =
      audience === 'ADMIN'
        ? { adminUserId: recipientId, status: { not: 'READ' as const } }
        : { customerId: recipientId, status: { not: 'READ' as const } };
    return this.prisma.notification.count({ where });
  }
}
