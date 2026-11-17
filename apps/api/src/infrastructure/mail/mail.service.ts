import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/env';
import { MAIL_TRANSPORT, type MailMessage, type MailTransport } from './mail.types';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.logger.log(`Mail transport: ${transport.name}`);
  }

  /**
   * Send a transactional email. Failures are logged and reported to the caller as `false` so
   * that, e.g., registration still succeeds and the user can request a resend.
   */
  async send(message: MailMessage): Promise<boolean> {
    try {
      await this.transport.send({ ...message, from: this.config.mail.from });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send ${message.template}: ${(error as Error).message}`);
      return false;
    }
  }

  link(path: string, params: Record<string, string>): string {
    const url = new URL(path, `${this.config.webAppUrl}/`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url.toString();
  }
}
