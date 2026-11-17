import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: true,
      connectTimeout: 5000,
      lazyConnect: false,
    });
    this.client.on('error', (err) => this.logger.warn(`Redis error: ${err.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => this.client.disconnect());
  }

  async ping(): Promise<number> {
    const started = performance.now();
    await this.client.ping();
    return Math.round(performance.now() - started);
  }
}
