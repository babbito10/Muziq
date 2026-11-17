import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/** OWASP-recommended argon2id parameters (m=19 MiB, t=2, p=1). Algorithm defaults to argon2id. */
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

@Injectable()
export class PasswordService {
  private dummyHash: Promise<string> | null = null;

  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  /**
   * Burn comparable CPU time when the account does not exist, so response timing does not reveal
   * whether an email is registered.
   */
  async verifyDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash('musicverse-dummy-password-for-timing');
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
