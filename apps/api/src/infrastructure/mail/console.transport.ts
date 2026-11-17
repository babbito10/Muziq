import { Logger } from '@nestjs/common';
import type { MailMessage, MailTransport } from './mail.types';

/**
 * DEVELOPMENT-ONLY mail transport. It does NOT deliver email: it logs a summary (including links,
 * so developers can complete verification flows locally) and keeps the last messages in memory
 * for automated tests. Configuration validation refuses this transport when NODE_ENV=production.
 */
export class ConsoleMailTransport implements MailTransport {
  readonly name = 'console (development only — emails are not delivered)';
  private readonly logger = new Logger('DevMail');
  readonly outbox: Array<MailMessage & { from: string; sentAt: Date }> = [];
  private static readonly OUTBOX_LIMIT = 200;

  async send(message: MailMessage & { from: string }): Promise<void> {
    this.outbox.push({ ...message, sentAt: new Date() });
    if (this.outbox.length > ConsoleMailTransport.OUTBOX_LIMIT) this.outbox.shift();
    this.logger.log(`[NOT SENT] ${message.template} → ${message.to}: ${message.subject}\n${message.text}`);
  }

  /** Most recent message to `to` (optionally for a template). Used by tests. */
  latest(to: string, template?: string) {
    return [...this.outbox].reverse().find((m) => m.to === to && (!template || m.template === template));
  }
}
