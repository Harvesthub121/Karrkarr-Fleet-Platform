import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AppLogger } from '../logger/app.logger';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

/**
 * Global exception filter.
 *
 * Responsibilities:
 *   1. Convert Prisma errors to meaningful HTTP responses (P2002 → 409, P2025 → 404).
 *   2. Strip stack traces from production responses.
 *   3. Log every 5xx error with the full trace so on-call has context.
 *
 * We deliberately do NOT swallow 4xx errors into a generic message — the
 * class-validator ValidationPipe produces descriptive 400s that clients need
 * to display field-level errors in forms.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<{ url: string }>();

    const { statusCode, message } = this.resolveStatus(exception);

    const body: ErrorResponse = {
      statusCode,
      error: HttpStatus[statusCode] ?? 'Unknown Error',
      message,
      timestamp: new Date().toISOString(),
      path: req.url,
    };

    if (statusCode >= 500) {
      this.logger.error(
        `${statusCode} ${req.url}: ${JSON.stringify(message)}`,
        exception instanceof Error ? exception.stack : undefined,
        GlobalExceptionFilter.name,
      );
    }

    res.status(statusCode).json(body);
  }

  private resolveStatus(exception: unknown): { statusCode: number; message: string | string[] } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : (response as { message?: string | string[] }).message ?? exception.message;
      return { statusCode: exception.getStatus(), message };
    }

    // Prisma known request errors — map codes to meaningful HTTP statuses
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrismaError(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { statusCode: HttpStatus.BAD_REQUEST, message: 'Invalid query parameters' };
    }

    // Unhandled — 500
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : String(exception),
    };
  }

  private mapPrismaError(
    err: Prisma.PrismaClientKnownRequestError,
  ): { statusCode: number; message: string } {
    switch (err.code) {
      case 'P2002': {
        // Unique constraint violation — P2002 meta contains the field names
        const fields = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `A record with this ${fields} already exists.`,
        };
      }
      case 'P2025':
        return { statusCode: HttpStatus.NOT_FOUND, message: 'Record not found.' };
      case 'P2003':
        return { statusCode: HttpStatus.CONFLICT, message: 'Foreign key constraint failed.' };
      case 'P2014':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'This change would violate a required relation.',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message:
            process.env.NODE_ENV === 'production'
              ? 'Database error'
              : `Prisma error ${err.code}: ${err.message}`,
        };
    }
  }
}
