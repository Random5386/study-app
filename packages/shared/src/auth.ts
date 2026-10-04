import { z } from 'zod';

// Rules for account data. The React forms and the Express routes both use these,
// so the browser and the server always agree. See docs/06-authentication-sessions.md.

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128; // argon2 can hash more, but a cap stops huge-input abuse

/** Trimmed, lower-cased email address. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .pipe(z.email('Enter a valid email address'));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`);

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your name')
  .max(60, 'Use at most 60 characters');

/** A 6-digit authenticator code, or a recovery code like "a1b2c-3d4e5". */
export const mfaCodeSchema = z
  .string()
  .trim()
  .min(6, 'Enter the 6-digit code')
  .max(20, 'That code is too long');

/** Random token from an emailed link. */
export const linkTokenSchema = z.string().trim().min(20).max(200);

export const registerSchema = z.object({
  email: emailSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const mfaVerifySchema = z.object({ code: mfaCodeSchema });
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

export const verifyEmailSchema = z.object({ token: linkTokenSchema });

export const emailOnlySchema = z.object({ email: emailSchema });
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;

export const resetPasswordSchema = z.object({
  token: linkTokenSchema,
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(PASSWORD_MAX),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Re-enter your password before a security change. */
export const passwordConfirmSchema = z.object({
  password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX),
});
export type PasswordConfirmInput = z.infer<typeof passwordConfirmSchema>;

export const mfaDisableSchema = z.object({
  password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX),
  code: mfaCodeSchema,
});
export type MfaDisableInput = z.infer<typeof mfaDisableSchema>;

/** Settings → Profile. Only these fields can be changed here (anything else in the body is dropped). */
export const updateProfileSchema = z.object({ displayName: displayNameSchema });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** Deleting your account needs your password, a typed confirmation, and your MFA code if it's on. */
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX),
  confirm: z.literal('DELETE', 'Type DELETE to confirm'),
  code: mfaCodeSchema.optional(),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

// ---- Shapes the API sends back ----

/** Safe-to-share account details. Never includes hashes or secrets. */
export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
};

/** GET /api/auth/session: always 200, so signed-out visitors don't see errors. */
export type SessionResponse = { user: PublicUser | null; mfaPending: boolean };

export type LoginResponse = { mfaRequired: boolean; csrfToken: string; user?: PublicUser };

export type MfaSetupResponse = { qrCodeDataUrl: string; manualKey: string };

export type RecoveryCodesResponse = { recoveryCodes: string[] };

export type ActiveSession = {
  id: string;
  current: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
};

export type AuditEntry = {
  id: string;
  event: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};
