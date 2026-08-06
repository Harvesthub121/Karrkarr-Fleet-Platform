import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Health endpoints.
 *
 * Two distinct checks, because conflating them causes outages:
 *
 *   /health   — liveness. Cheap, no dependencies. If this fails the process is
 *               wedged and ECS should replace the task. It must NOT check the
 *               database: a brief RDS failover would otherwise make ECS kill
 *               every healthy task at once and turn a 30-second blip into a
 *               full outage.
 *
 *   /health/ready — readiness. Verifies Postgres is actually reachable. The
 *               ALB target group uses this to stop routing traffic to a task
 *               that cannot serve requests, without killing it.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe — no dependencies checked' })
  liveness() {
    return {
      status: 'ok',
      service: 'vida-fleet-api',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — verifies database connectivity' })
  async readiness() {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        database: 'up',
        latencyMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'degraded',
        database: 'down',
        error: error instanceof Error ? error.message : 'unknown',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
