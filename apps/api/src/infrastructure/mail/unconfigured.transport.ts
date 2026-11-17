import type { MailTransport } from './mail.types';

/**
 * Used when no email provider is configured (MAIL_TRANSPORT=none). Every send fails, so callers
 * report it honestly (e.g. "resend verification" returns 503) instead of pretending success.
 */
export class UnconfiguredMailTransport implements MailTransport {
  readonly name = 'none (email delivery not configured — messages are not sent)';

  async send(): Promise<void> {
    throw new Error('Email delivery is not configured (MAIL_TRANSPORT=none)');
  }
}
