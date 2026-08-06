import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { MoneySerializerInterceptor } from './common/interceptors/money-serializer.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AppLogger } from './common/logger/app.logger';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Use our structured logger from the start so boot errors appear consistently
    bufferLogs: true,
  });

  const logger = app.get(AppLogger);
  app.useLogger(logger);
  app.flushLogs();

  // ---------------------------------------------------------------------------
  // Security headers
  // ---------------------------------------------------------------------------
  app.use(
    helmet({
      // Allow Swagger UI to load its own scripts in development
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  // ---------------------------------------------------------------------------
  // CORS — strict allowlist; credentials (cookies) are not used (JWT in header)
  // ---------------------------------------------------------------------------
  const rawOrigins = process.env.CORS_ORIGINS ?? '';
  const allowedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // We do not use cookie-based sessions; exposing credentials: true would be
    // over-broad and could enable CSRF with wildcard origins in misconfiguration
    credentials: false,
  });

  // ---------------------------------------------------------------------------
  // Global pipes / filters / interceptors
  // ---------------------------------------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      // Strip unknown properties — prevents parameter pollution
      whitelist: true,
      // Reject requests that send extra properties rather than silently dropping
      forbidNonWhitelisted: true,
      // Transform plain JSON objects into typed DTO instances
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  // Retrieve from DI container so PrismaService is properly injected
  const auditInterceptor = app.get(AuditInterceptor);
  app.useGlobalInterceptors(
    // MoneySerializer must run before Audit so audit logs see the original bigint
    new MoneySerializerInterceptor(),
    auditInterceptor,
  );

  // ---------------------------------------------------------------------------
  // Swagger — only exposed in non-production (or when explicitly enabled)
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Vida Partners Fleet API')
      .setDescription(
        'Fleet leasing management API for Vida Partners Pte Ltd. ' +
          'Admin and customer portals share this API with separate JWT audiences.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'AdminJWT',
      )
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'CustomerJWT',
      )
      .addTag('auth', 'Authentication & refresh tokens')
      .addTag('branches', 'Branch management')
      .addTag('users', 'Admin user management')
      .addTag('customers', 'Customer accounts & invite flow')
      .addTag('vehicles', 'Fleet vehicles & status machine')
      .addTag('maintenance', 'Service records & accident records')
      .addTag('rentals', 'Rental agreements')
      .addTag('documents', 'Document upload/download via S3')
      .addTag('policy', 'Business policy settings')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Graceful shutdown — let Kubernetes finish in-flight requests before SIGTERM
  // ---------------------------------------------------------------------------
  app.enableShutdownHooks();

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  logger.log(`Vida Fleet API listening on port ${port}`, 'Bootstrap');
  logger.log(
    `Swagger docs: http://localhost:${port}/docs`,
    'Bootstrap',
  );
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
