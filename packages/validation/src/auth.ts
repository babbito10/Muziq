import { z } from 'zod';
import {
  clientTypeSchema,
  emailSchema,
  opaqueTokenSchema,
  passwordSchema,
  totpCodeSchema,
} from './common';
import { displayNameSchema } from './users';

export const registerSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  clientType: clientTypeSchema,
  acceptTerms: z.literal(true, { error: 'You must accept the terms to create an account' }),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.strictObject({
  email: emailSchema,
  // Do not apply strength rules on login — only presence and an upper bound.
  password: z.string().min(1, 'Enter your password').max(128),
  clientType: clientTypeSchema,
});
export type LoginInput = z.input<typeof loginSchema>;

export const mfaVerifySchema = z.strictObject({
  mfaToken: z.string().min(1).max(2048),
  code: totpCodeSchema,
  clientType: clientTypeSchema,
});
export type MfaVerifyInput = z.input<typeof mfaVerifySchema>;

/** Web clients send the refresh token as a cookie, so the body field is optional. */
export const refreshSchema = z.strictObject({
  refreshToken: opaqueTokenSchema.optional(),
  clientType: clientTypeSchema,
});
export type RefreshInput = z.input<typeof refreshSchema>;

export const logoutSchema = z.strictObject({
  refreshToken: opaqueTokenSchema.optional(),
});
export type LogoutInput = z.input<typeof logoutSchema>;

export const verifyEmailSchema = z.strictObject({ token: opaqueTokenSchema });
export type VerifyEmailInput = z.input<typeof verifyEmailSchema>;

export const forgotPasswordSchema = z.strictObject({ email: emailSchema });
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.strictObject({
  token: opaqueTokenSchema,
  password: passwordSchema,
});
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .strictObject({
    currentPassword: z.string().min(1, 'Enter your current password').max(128),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from your current one',
  });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

export const oauthSignInSchema = z.strictObject({
  idToken: z.string().min(20).max(8192),
  /** Raw nonce the client generated; required by Apple, optional for Google. */
  nonce: z.string().min(8).max(256).optional(),
  /** Apple only sends the user's name on first sign-in, via the client. */
  displayName: z.string().trim().min(1).max(80).optional(),
  clientType: clientTypeSchema,
});
export type OAuthSignInInput = z.input<typeof oauthSignInSchema>;

export const totpConfirmSchema = z.strictObject({ code: totpCodeSchema });
export type TotpConfirmInput = z.input<typeof totpConfirmSchema>;

export const totpDisableSchema = z.strictObject({
  password: z.string().min(1).max(128).optional(),
  code: totpCodeSchema,
});
export type TotpDisableInput = z.input<typeof totpDisableSchema>;
