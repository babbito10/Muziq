import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestMeta } from '../../common/http/request-meta';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/** Stable audit action names. Add new actions here rather than using ad-hoc strings. */
export type AuditAction =
  | 'auth.register'
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.logout'
  | 'auth.refresh.reuse_detected'
  | 'auth.email.verified'
  | 'auth.password.reset_requested'
  | 'auth.password.reset'
  | 'auth.password.changed'
  | 'auth.mfa.enabled'
  | 'auth.mfa.disabled'
  | 'auth.mfa.failure'
  | 'auth.session.revoked'
  | 'auth.oauth.linked'
  | 'auth.oauth.registered'
  | 'user.profile.updated'
  | 'user.capability.added'
  | 'user.capability.removed'
  | 'user.deletion.scheduled'
  | 'user.anonymised'
  | 'admin.role.granted'
  | 'admin.role.revoked'
  | 'admin.user.suspended'
  | 'admin.user.reinstated';

export interface AuditEntry {
  action: AuditAction;
  actorId?: string | null;
  targetType?: 'user' | 'session' | 'role' | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}

type Db = Pick<Prisma.TransactionClient, 'auditLog'>;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Append an audit record. Pass a transaction client to make it atomic with the change. */
  async record(entry: AuditEntry, meta: Partial<RequestMeta> = {}, db: Db = this.prisma): Promise<void> {
    await db.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId ?? null,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
        requestId: meta.requestId ?? null,
      },
    });
  }
}
