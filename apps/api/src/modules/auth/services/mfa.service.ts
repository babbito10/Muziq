import { Inject, Injectable } from '@nestjs/common';
import type { TotpSetupResponse } from '@musicverse/types';
import { APP_CONFIG } from '../../../config/config.module';
import type { AppConfig } from '../../../config/env';
import { AppError } from '../../../common/errors/app-error';
import type { RequestMeta } from '../../../common/http/request-meta';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import { decryptSecret, encryptSecret } from './crypto';
import { PasswordService } from './password.service';
import { generateTotpSecret, otpauthUrl, verifyTotp } from './totp';

/** Max wrong codes per MFA login challenge before the challenge is burned. */
export const MAX_CHALLENGE_ATTEMPTS = 5;

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async isEnabled(userId: string): Promise<boolean> {
    const factor = await this.prisma.mfaFactor.findUnique({ where: { userId_type: { userId, type: 'totp' } } });
    return !!factor?.confirmedAt;
  }

  async beginSetup(userId: string): Promise<TotpSetupResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { mfaFactors: true },
    });
    if (user.mfaFactors.some((f) => f.type === 'totp' && f.confirmedAt)) {
      throw AppError.conflict('MFA_ALREADY_ENABLED', 'Two-step verification is already enabled.');
    }
    const secret = generateTotpSecret();
    const secretEncrypted = encryptSecret(secret, this.config.auth.mfaEncryptionKey);
    await this.prisma.mfaFactor.upsert({
      where: { userId_type: { userId, type: 'totp' } },
      create: { userId, type: 'totp', secretEncrypted },
      update: { secretEncrypted, confirmedAt: null, lastUsedStep: null },
    });
    return { secret, otpauthUrl: otpauthUrl({ secret, accountName: user.email }) };
  }

  async confirmSetup(userId: string, code: string, meta: RequestMeta): Promise<void> {
    const factor = await this.prisma.mfaFactor.findUnique({ where: { userId_type: { userId, type: 'totp' } } });
    if (!factor) throw AppError.badRequest('MFA_NOT_ENABLED', 'Start two-step verification setup first.');
    if (factor.confirmedAt) throw AppError.conflict('MFA_ALREADY_ENABLED', 'Two-step verification is already enabled.');
    const step = verifyTotp(decryptSecret(factor.secretEncrypted, this.config.auth.mfaEncryptionKey), code);
    if (step === null) throw AppError.badRequest('INVALID_MFA_CODE', 'That code is not valid. Try the latest code.');
    await this.prisma.$transaction(async (tx) => {
      await tx.mfaFactor.update({
        where: { id: factor.id },
        data: { confirmedAt: new Date(), lastUsedStep: BigInt(step) },
      });
      await this.audit.record({ action: 'auth.mfa.enabled', actorId: userId, targetType: 'user', targetId: userId }, meta, tx);
    });
  }

  async disable(userId: string, input: { password?: string; code: string }, meta: RequestMeta): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.passwordHash) {
      if (!input.password || !(await this.passwords.verify(user.passwordHash, input.password))) {
        throw AppError.unauthorized('INVALID_CREDENTIALS', 'Your password is incorrect.');
      }
    }
    await this.verifyCode(userId, input.code, meta);
    await this.prisma.$transaction(async (tx) => {
      await tx.mfaFactor.deleteMany({ where: { userId, type: 'totp' } });
      await this.audit.record({ action: 'auth.mfa.disabled', actorId: userId, targetType: 'user', targetId: userId }, meta, tx);
    });
  }

  /**
   * Verify a TOTP code for a confirmed factor, enforcing replay protection atomically: the stored
   * last-used step only advances if no concurrent request already used this (or a later) step.
   */
  async verifyCode(userId: string, code: string, meta: RequestMeta, challengeId?: string): Promise<void> {
    if (challengeId) {
      const key = `mfa:attempts:${challengeId}`;
      const attempts = await this.redis.client.incr(key);
      if (attempts === 1) await this.redis.client.expire(key, 600);
      if (attempts > MAX_CHALLENGE_ATTEMPTS) {
        throw AppError.unauthorized('INVALID_TOKEN', 'Too many incorrect codes. Please sign in again.');
      }
    }
    const factor = await this.prisma.mfaFactor.findUnique({ where: { userId_type: { userId, type: 'totp' } } });
    if (!factor?.confirmedAt) throw AppError.badRequest('MFA_NOT_ENABLED', 'Two-step verification is not enabled.');

    const lastUsedStep = factor.lastUsedStep === null ? null : Number(factor.lastUsedStep);
    const secret = decryptSecret(factor.secretEncrypted, this.config.auth.mfaEncryptionKey);
    const step = verifyTotp(secret, code, { lastUsedStep });
    const accepted =
      step !== null &&
      (
        await this.prisma.mfaFactor.updateMany({
          where: {
            id: factor.id,
            OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: BigInt(step) } }],
          },
          data: { lastUsedStep: BigInt(step) },
        })
      ).count === 1;

    if (!accepted) {
      await this.audit.record({ action: 'auth.mfa.failure', actorId: userId, targetType: 'user', targetId: userId }, meta);
      throw AppError.unauthorized('INVALID_MFA_CODE', 'That code is not valid. Try the latest code.');
    }
  }
}
