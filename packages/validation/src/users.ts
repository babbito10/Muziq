import { CAPABILITY_ROLES, ROLE_KEYS } from '@musicverse/types';
import { z } from 'zod';
import { emailSchema, paginationQuerySchema } from './common';

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a display name')
  .max(80, 'Use at most 80 characters');

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Use at least 3 characters')
  .max(30, 'Use at most 30 characters')
  .regex(/^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/, 'Use letters, numbers, dots and underscores');

export const updateProfileSchema = z
  .strictObject({
    displayName: displayNameSchema.optional(),
    username: usernameSchema.nullable().optional(),
    bio: z.string().trim().max(500, 'Use at most 500 characters').nullable().optional(),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, 'Use a 2-letter country code')
      .nullable()
      .optional(),
    locale: z
      .string()
      .trim()
      .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'Use a locale such as en or en-KE')
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export const updatePreferencesSchema = z
  .strictObject({
    theme: z.enum(['dark', 'light', 'system']).optional(),
    explicitContent: z.boolean().optional(),
    emailNotifications: z
      .strictObject({
        product: z.boolean().optional(),
        social: z.boolean().optional(),
        security: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one preference' });
export type UpdatePreferencesInput = z.input<typeof updatePreferencesSchema>;

export const capabilitySchema = z.strictObject({ role: z.enum(CAPABILITY_ROLES) });
export type CapabilityInput = z.input<typeof capabilitySchema>;

export const deleteAccountSchema = z.strictObject({
  /** Required for accounts with a password. Social-only accounts confirm by phrase. */
  password: z.string().min(1).max(128).optional(),
  confirm: z.literal('DELETE', { error: 'Type DELETE to confirm' }),
});
export type DeleteAccountInput = z.input<typeof deleteAccountSchema>;

/** Admin */
export const adminListUsersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['active', 'suspended', 'pending_deletion', 'deleted']).optional(),
  role: z.enum(ROLE_KEYS).optional(),
  q: z.string().trim().min(1).max(254).optional(),
});
export type AdminListUsersQuery = z.infer<typeof adminListUsersQuerySchema>;

export const adminGrantRoleSchema = z.strictObject({ role: z.enum(ROLE_KEYS) });
export type AdminGrantRoleInput = z.input<typeof adminGrantRoleSchema>;

export const adminSuspendSchema = z.strictObject({
  reason: z.string().trim().min(3, 'Give a reason').max(500),
});
export type AdminSuspendInput = z.input<typeof adminSuspendSchema>;

export const auditLogQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().max(100).optional(),
  actorId: z.uuid().optional(),
  targetId: z.uuid().optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export { emailSchema };
