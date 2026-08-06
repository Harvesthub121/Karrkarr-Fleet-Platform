import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './prisma/prisma.module';
import { AppLogger } from './common/logger/app.logger';
import { RequestContextModule } from './common/request-context/request-context.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

// Feature modules written by this engineer
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { UsersModule } from './modules/users/users.module';
import { CustomersModule } from './modules/customers/customers.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { RentalsModule } from './modules/rentals/rentals.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { PolicyModule } from './modules/policy/policy.module';

// Modules owned by other engineers — imported so the DI graph is complete and
// the monorepo builds as a unit; their files will exist when they write them.
import { BillingModule } from './modules/billing/billing.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CollectionsModule } from './modules/collections/collections.module';

import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    HealthModule,
    // -------------------------------------------------------------------------
    // Configuration — loads .env, validates presence of required vars
    // -------------------------------------------------------------------------
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      // We validate critical env vars at startup so a misconfigured deploy fails
      // fast with a meaningful error rather than blowing up mid-request.
      validate: (config: Record<string, unknown>) => {
        const required = [
          'DATABASE_URL',
          'JWT_ADMIN_SECRET',
          'JWT_CUSTOMER_SECRET',
          'S3_BUCKET',
          'AWS_REGION',
        ];
        for (const key of required) {
          if (!config[key]) {
            throw new Error(`Missing required environment variable: ${key}`);
          }
        }
        return config;
      },
    }),

    // -------------------------------------------------------------------------
    // BullMQ — jobs queue backed by Redis
    // -------------------------------------------------------------------------
    BullModule.forRoot({
      connection: {
        // REDIS_URL format: redis://[:password@]host[:port]
        // BullMQ's forRoot accepts a parsed object; we parse the URL manually
        // so a single env var works for both local and cloud Redis.
        ...((): { host: string; port: number; password?: string } => {
          const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
          const parsed = new URL(url);
          const opts: { host: string; port: number; password?: string } = {
            host: parsed.hostname,
            port: parseInt(parsed.port || '6379', 10),
          };
          if (parsed.password) opts.password = parsed.password;
          return opts;
        })(),
      },
    }),

    // -------------------------------------------------------------------------
    // Scheduled tasks (cron) — used by JobsModule
    // -------------------------------------------------------------------------
    ScheduleModule.forRoot(),

    // -------------------------------------------------------------------------
    // Infrastructure
    // -------------------------------------------------------------------------
    RequestContextModule,
    PrismaModule,

    // -------------------------------------------------------------------------
    // Feature modules
    // -------------------------------------------------------------------------
    AuthModule,
    BranchesModule,
    UsersModule,
    CustomersModule,
    VehiclesModule,
    MaintenanceModule,
    RentalsModule,
    DocumentsModule,
    PolicyModule,

    // Other engineers' modules
    BillingModule,
    PaymentsModule,
    NotificationsModule,
    JobsModule,
    ReportsModule,
    CollectionsModule,
  ],
  providers: [AppLogger, AuditInterceptor],
  exports: [AppLogger],
})
export class AppModule {}
