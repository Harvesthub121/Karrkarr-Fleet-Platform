/**
 * ExpiryReminderProcessor — daily sweep for vehicle compliance expiries.
 *
 * Ladder thresholds from policy:
 *   COE: 90, 60, 30, 7 days
 *   Road tax / insurance / inspection: 30, 14, 7 days
 *
 * Idempotency: ExpiryReminderLog unique on (vehicleId, expiryType, daysBefore, expiryDate).
 * Renewing a road tax gets a new expiryDate, which re-arms the entire ladder naturally.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ExpiryType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PolicyService } from '../../policy/policy.service';
import { NotificationService } from '../../notifications/notification.service';
import { POLICY_KEYS, parseDayLadder } from '@karrkarr/shared';
import { QUEUE_NAMES } from '../jobs.module';

function sgtToday(): Date {
  const now = new Date();
  const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate()));
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

interface ExpiryCheck {
  type: ExpiryType;
  expiryDate: Date | null;
  eventType: string;
  ladderKey: string;
  displayName: string;
}

@Processor(QUEUE_NAMES.EXPIRY_REMINDER)
export class ExpiryReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ExpiryReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly notifications: NotificationService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log('Expiry reminder sweep started');
    const today = sgtToday();

    const vehicles = await this.prisma.vehicle.findMany({
      where: { isActive: true, status: { not: 'SOLD' } },
      select: {
        id: true,
        plateNumber: true,
        make: true,
        model: true,
        branchId: true,
        coeExpiry: true,
        roadTaxExpiry: true,
        insuranceExpiry: true,
        inspectionDue: true,
        nextServiceDate: true,
      },
    });

    for (const vehicle of vehicles) {
      const checks: ExpiryCheck[] = [
        {
          type: 'COE',
          expiryDate: vehicle.coeExpiry,
          eventType: 'vehicle.coe_expiring',
          ladderKey: POLICY_KEYS.EXPIRY_COE_DAYS,
          displayName: 'COE',
        },
        {
          type: 'ROAD_TAX',
          expiryDate: vehicle.roadTaxExpiry,
          eventType: 'vehicle.road_tax_expiring',
          ladderKey: POLICY_KEYS.EXPIRY_ROAD_TAX_DAYS,
          displayName: 'Road Tax',
        },
        {
          type: 'INSURANCE',
          expiryDate: vehicle.insuranceExpiry,
          eventType: 'vehicle.insurance_expiring',
          ladderKey: POLICY_KEYS.EXPIRY_INSURANCE_DAYS,
          displayName: 'Insurance',
        },
        {
          type: 'INSPECTION',
          expiryDate: vehicle.inspectionDue,
          eventType: 'vehicle.inspection_due',
          ladderKey: POLICY_KEYS.EXPIRY_INSPECTION_DAYS,
          displayName: 'Inspection',
        },
        {
          type: 'SERVICE_DUE',
          expiryDate: vehicle.nextServiceDate,
          eventType: 'vehicle.inspection_due',
          ladderKey: POLICY_KEYS.EXPIRY_SERVICE_DAYS,
          displayName: 'Service',
        },
      ];

      for (const check of checks) {
        if (!check.expiryDate) continue;
        try {
          await this.processExpiryCheck(vehicle, check, today);
        } catch (err: any) {
          this.logger.error(
            `Expiry check failed for vehicle ${vehicle.id} type ${check.type}: ${err.message}`,
          );
        }
      }
    }

    this.logger.log(`Expiry sweep complete for ${vehicles.length} vehicles`);
  }

  private async processExpiryCheck(
    vehicle: any,
    check: ExpiryCheck,
    today: Date,
  ): Promise<void> {
    const expiryDate = new Date(check.expiryDate!);
    const daysRemaining = daysBetween(today, expiryDate);

    if (daysRemaining < 0) return; // Already expired — different workflow

    const ladderRaw = String(
      await this.policy.get(check.ladderKey as any, { branchId: vehicle.branchId }),
    );
    const ladder = parseDayLadder(ladderRaw);

    if (!ladder.includes(daysRemaining)) return;

    // Check idempotency — unique on (vehicleId, expiryType, daysBefore, expiryDate)
    const alreadySent = await this.prisma.expiryReminderLog.findUnique({
      where: {
        vehicleId_expiryType_daysBefore_expiryDate: {
          vehicleId: vehicle.id,
          expiryType: check.type,
          daysBefore: daysRemaining,
          expiryDate,
        },
      },
    });
    if (alreadySent) return;

    await this.notifications.fanOutToAdmins({
      branchId: vehicle.branchId,
      eventType: check.eventType,
      title: `${check.displayName} Expiring in ${daysRemaining} days – ${vehicle.plateNumber}`,
      body: `Vehicle ${vehicle.plateNumber} (${vehicle.make} ${vehicle.model}) ${check.displayName} expires on ${expiryDate.toLocaleDateString('en-SG')}.`,
      actionUrl: `/admin/vehicles/${vehicle.id}`,
      severity: daysRemaining <= 7 ? 'critical' : daysRemaining <= 14 ? 'warning' : 'info',
      metadata: {
        plateNumber: vehicle.plateNumber,
        make: vehicle.make,
        model: vehicle.model,
        expiryType: check.type,
        expiryDate: expiryDate.toISOString().slice(0, 10),
        daysBefore: daysRemaining,
      },
    });

    await this.prisma.expiryReminderLog.create({
      data: {
        vehicleId: vehicle.id,
        expiryType: check.type,
        daysBefore: daysRemaining,
        expiryDate,
      },
    });
  }
}
