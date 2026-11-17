import { Injectable } from '@nestjs/common';
import type { VerificationTokenType } from '@prisma/client';
import { AppError } from '../../../common/errors/app-error';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { generateOpaqueToken, sha256Hex } from './crypto';

export const TOKEN_TTL_MS: Record<VerificationTokenType, number> = {
  email_verification: 24 * 60 * 60 * 1000,
  password_reset: 30 * 60 * 1000,
};

/** Single-use, hashed, expiring tokens for email verification and password reset. */
@Injectable()
export class VerificationTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Issue a new token, invalidating any outstanding token of the same type for the user. */
  async issue(userId: string, type: VerificationTokenType): Promise<string> {
    const token = generateOpaqueToken();
    await this.prisma.$transaction([
      this.prisma.verificationToken.deleteMany({ where: { userId, type, consumedAt: null } }),
      this.prisma.verificationToken.create({
        data: {
          userId,
          type,
          tokenHash: sha256Hex(token),
          expiresAt: new Date(Date.now() + TOKEN_TTL_MS[type]),
        },
      }),
    ]);
    return token;
  }

  /** Atomically consume a token; returns the owning user id. */
  async consume(token: string, type: VerificationTokenType): Promise<string> {
    const tokenHash = sha256Hex(token);
    const now = new Date();
    const { count } = await this.prisma.verificationToken.updateMany({
      where: { tokenHash, type, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (count !== 1) {
      throw AppError.badRequest(
        'INVALID_TOKEN',
        'This link is invalid or has expired. Please request a new one.',
      );
    }
    const record = await this.prisma.verificationToken.findUniqueOrThrow({ where: { tokenHash } });
    return record.userId;
  }
}
