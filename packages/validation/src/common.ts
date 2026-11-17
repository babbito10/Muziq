import { z } from 'zod';

/** Lower-cased, trimmed email address. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .pipe(z.email('Enter a valid email address'));

/**
 * A short deny-list of the most common passwords. The API additionally relies on rate limiting;
 * a breached-password (k-anonymity) check is planned for Phase 2.
 */
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '1234567890',
  '12345678910',
  'qwertyuiop',
  'iloveyou123',
  'musicverse',
  'musicverse1',
  'letmein123',
  'welcome123',
  'abcdefghij',
  '0123456789',
  'qwerty1234',
  'football123',
]);

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`)
  .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), {
    message: 'This password is too common. Choose something harder to guess.',
  });

export const clientTypeSchema = z.enum(['web', 'mobile', 'admin']).default('web');

export const uuidSchema = z.uuid('Invalid identifier');

/** Opaque URL-safe token (verification, reset, refresh). */
export const opaqueTokenSchema = z
  .string()
  .min(20, 'Invalid token')
  .max(512, 'Invalid token')
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid token');

export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app');

export const paginationQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(512).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
