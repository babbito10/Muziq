import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { HealthResponse } from '@musicverse/types';
import type { Response } from 'express';
import { Public } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

const VERSION = process.env.APP_VERSION ?? process.env.npm_package_version ?? '0.1.0';
const TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)),
  ]);
}

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness: the process is running' })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @HttpCode(200)
  @ApiOperation({ summary: 'Readiness: database and Redis reachable (503 otherwise)' })
  async ready(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const checks: HealthResponse['checks'] = {};
    const probe = async (name: string, fn: () => Promise<number>) => {
      try {
        checks[name] = { status: 'up', latencyMs: await withTimeout(fn()) };
      } catch (error) {
        checks[name] = { status: 'down', error: (error as Error).message.slice(0, 200) };
      }
    };
    await Promise.all([probe('database', () => this.prisma.ping()), probe('redis', () => this.redis.ping())]);
    const healthy = Object.values(checks).every((c) => c.status === 'up');
    if (!healthy) res.status(503);
    return { status: healthy ? 'ok' : 'degraded', checks, version: VERSION, uptimeSeconds: Math.round(process.uptime()) };
  }
}
