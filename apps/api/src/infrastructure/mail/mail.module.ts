import { Global, Module } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/env';
import { ConsoleMailTransport } from './console.transport';
import { MailService } from './mail.service';
import { MAIL_TRANSPORT } from './mail.types';
import { SmtpMailTransport } from './smtp.transport';
import { UnconfiguredMailTransport } from './unconfigured.transport';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        config.mail.transport === 'smtp'
          ? new SmtpMailTransport({ ...config.mail.smtp, host: config.mail.smtp.host! })
          : config.mail.transport === 'none'
            ? new UnconfiguredMailTransport()
            : new ConsoleMailTransport(),
    },
    MailService,
  ],
  exports: [MailService, MAIL_TRANSPORT],
})
export class MailModule {}
