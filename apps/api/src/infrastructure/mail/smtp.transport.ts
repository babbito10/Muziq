import { createTransport, type Transporter } from 'nodemailer';
import type { MailMessage, MailTransport } from './mail.types';

/** Delivers email through any SMTP provider (SendGrid, Mailgun, SES, Postmark, Mailpit locally…). */
export class SmtpMailTransport implements MailTransport {
  readonly name = 'smtp';
  private readonly transporter: Transporter;

  constructor(options: { host: string; port?: number; secure: boolean; user?: string; password?: string }) {
    this.transporter = createTransport({
      host: options.host,
      port: options.port ?? (options.secure ? 465 : 587),
      secure: options.secure,
      auth: options.user ? { user: options.user, pass: options.password } : undefined,
    });
  }

  async send(message: MailMessage & { from: string }): Promise<void> {
    await this.transporter.sendMail({
      from: message.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      headers: { 'X-MusicVerse-Template': message.template },
    });
  }
}
