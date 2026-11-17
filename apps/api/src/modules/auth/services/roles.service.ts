import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ROLE_KEYS, type RoleKey } from '@musicverse/types';
import { AppError } from '../../../common/errors/app-error';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/** Resolves role keys to database ids. Roles are synchronised by the seed (`db:seed`). */
@Injectable()
export class RolesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RolesService.name);
  private ids: Map<RoleKey, string> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.load();
    } catch (error) {
      this.logger.error((error as Error).message);
    }
  }

  private async load(): Promise<Map<RoleKey, string>> {
    const rows = await this.prisma.role.findMany({ select: { id: true, key: true } });
    const map = new Map(rows.map((r) => [r.key as RoleKey, r.id]));
    const missing = ROLE_KEYS.filter((k) => !map.has(k));
    if (missing.length > 0) {
      throw AppError.unavailable(
        'SERVICE_UNAVAILABLE',
        `Roles are not seeded (missing: ${missing.join(', ')}). Run the database seed.`,
      );
    }
    this.ids = map;
    return map;
  }

  async idFor(key: RoleKey): Promise<string> {
    const ids = this.ids ?? (await this.load());
    return ids.get(key)!;
  }
}
