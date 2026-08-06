import { Injectable, LogLevel, LoggerService } from '@nestjs/common';

/**
 * Structured JSON logger. In production each line is a valid JSON object so
 * CloudWatch / Datadog can parse and index fields without a custom parser.
 * In development we keep it human-readable.
 */
@Injectable()
export class AppLogger implements LoggerService {
  private readonly isProduction = process.env.NODE_ENV === 'production';

  private readonly levels: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];

  private shouldLog(level: LogLevel): boolean {
    const configured = (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'log';
    return this.levels.indexOf(level) <= this.levels.indexOf(configured);
  }

  private write(level: LogLevel, message: unknown, context?: string): void {
    if (!this.shouldLog(level)) return;

    if (this.isProduction) {
      const entry = {
        timestamp: new Date().toISOString(),
        level,
        context: context ?? 'App',
        message,
      };
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(entry));
    } else {
      const prefix = `[${context ?? 'App'}]`;
      // eslint-disable-next-line no-console
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        `${new Date().toISOString()} ${level.toUpperCase()} ${prefix}`,
        message,
      );
    }
  }

  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', { message, trace }, context);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }
}
