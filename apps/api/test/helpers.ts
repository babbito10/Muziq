import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { RoleKey } from '@musicverse/types';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { loadConfig } from '../src/config/env';
import { ConsoleMailTransport } from '../src/infrastructure/mail/console.transport';
import { MAIL_TRANSPORT } from '../src/infrastructure/mail/mail.types';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';

export const API = '/api/v1';
export const PASSWORD = 'correct horse battery staple';

export interface TestContext {
  app: NestExpressApplication;
  http: ReturnType<typeof request>;
  prisma: PrismaService;
  redis: RedisService;
  mail: ConsoleMailTransport;
  close(): Promise<void>;
}

export async function createTestApp(env: Record<string, string> = {}): Promise<TestContext> {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
  configureApp(app, loadConfig());
  await app.init();
  process.env = previous;
  const server = app.getHttpServer();
  return {
    app,
    http: request(server),
    prisma: app.get(PrismaService),
    redis: app.get(RedisService),
    mail: app.get<ConsoleMailTransport>(MAIL_TRANSPORT),
    close: () => app.close(),
  };
}

/** Remove all data except the seeded role/permission catalogue, and clear Redis. */
export async function resetData(ctx: TestContext): Promise<void> {
  await ctx.prisma.$executeRawUnsafe(
    'TRUNCATE TABLE audit_logs, verification_tokens, oauth_accounts, mfa_factors, sessions, user_roles, user_profiles, users CASCADE',
  );
  await ctx.redis.client.flushdb();
}

let counter = 0;
export function uniqueEmail(prefix = 'user'): string {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@example.com`;
}

/** Extract `name=value` from Set-Cookie headers. */
export function cookieValue(setCookie: string[] | string | undefined, name: string): string | undefined {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const line = list.find((c) => c.startsWith(`${name}=`));
  if (!line) return undefined;
  const value = line.split(';')[0]!.slice(name.length + 1);
  return value || undefined;
}

export interface RegisteredUser {
  id: string;
  email: string;
  accessToken: string;
  refreshCookie: string;
}

export async function registerUser(
  ctx: TestContext,
  overrides: Partial<{ email: string; password: string; displayName: string }> = {},
): Promise<RegisteredUser> {
  const email = overrides.email ?? uniqueEmail();
  const res = await ctx.http
    .post(`${API}/auth/register`)
    .send({
      email,
      password: overrides.password ?? PASSWORD,
      displayName: overrides.displayName ?? 'Test User',
      acceptTerms: true,
    })
    .expect(201);
  return {
    id: res.body.user.id,
    email,
    accessToken: res.body.accessToken,
    refreshCookie: cookieValue(res.headers['set-cookie'], 'mv_refresh')!,
  };
}

export function login(
  ctx: TestContext,
  email: string,
  password = PASSWORD,
  clientType: 'web' | 'mobile' | 'admin' = 'web',
) {
  return ctx.http.post(`${API}/auth/login`).send({ email, password, clientType });
}

export async function grantRoles(ctx: TestContext, userId: string, roles: RoleKey[]): Promise<void> {
  const rows = await ctx.prisma.role.findMany({ where: { key: { in: roles } } });
  await ctx.prisma.userRole.createMany({
    data: rows.map((r) => ({ userId, roleId: r.id })),
    skipDuplicates: true,
  });
  await ctx.redis.client.del(`authz:user:${userId}`);
}

export async function verifyEmailDirectly(ctx: TestContext, userId: string): Promise<void> {
  await ctx.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  await ctx.redis.client.del(`authz:user:${userId}`);
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

/** Token embedded in the latest email link for `to` (e.g. ?token=...). */
export function tokenFromMail(ctx: TestContext, to: string, template: string): string {
  const message = ctx.mail.latest(to, template);
  if (!message) throw new Error(`No ${template} email for ${to}`);
  const match = /[?&]token=([A-Za-z0-9_-]+)/.exec(message.text);
  if (!match) throw new Error('No token in email');
  return match[1]!;
}
