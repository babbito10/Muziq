/**
 * Scheduled job: anonymise accounts whose deletion grace period has elapsed.
 * Deployed as a Cloud Run Job triggered daily by Cloud Scheduler: `node dist/jobs/purge-deleted-accounts.js`.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const count = await app.get(UsersService).purgeExpiredDeletions();
    console.info(`Anonymised ${count} account(s).`);
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
