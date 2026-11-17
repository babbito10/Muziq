export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Template identifier, for logging and tests. */
  template: string;
}

export interface MailTransport {
  readonly name: string;
  send(message: MailMessage & { from: string }): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
