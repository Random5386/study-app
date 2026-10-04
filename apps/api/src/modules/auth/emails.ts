// The text of every email the app sends. Plain text keeps them simple and safe.
import { env } from '../../config/env.js';
import { sendMail } from '../../lib/mailer.js';

const link = (path: string, token: string) => `${env.APP_URL}${path}?token=${encodeURIComponent(token)}`;
const signOff = `\n\nThanks,\n${env.APP_NAME}`;

export const emails = {
  verifyEmail: (to: string, name: string, token: string) =>
    sendMail({
      to,
      subject: `Confirm your ${env.APP_NAME} email address`,
      text:
        `Hi ${name},\n\nConfirm your email address to finish creating your account:\n\n` +
        `${link('/verify-email', token)}\n\nThis link works once and expires in 24 hours.` +
        `\nIf you didn't sign up, you can ignore this email.${signOff}`,
    }),

  alreadyRegistered: (to: string) =>
    sendMail({
      to,
      subject: `Someone tried to sign up with your email`,
      text:
        `Someone tried to create a ${env.APP_NAME} account with this email address, but you already have one.` +
        `\n\nIf it was you, sign in instead: ${env.APP_URL}/login` +
        `\nForgot your password? Reset it: ${env.APP_URL}/forgot-password` +
        `\n\nIf it wasn't you, no action is needed.${signOff}`,
    }),

  resetPassword: (to: string, name: string, token: string) =>
    sendMail({
      to,
      subject: `Reset your ${env.APP_NAME} password`,
      text:
        `Hi ${name},\n\nUse this link to choose a new password:\n\n${link('/reset-password', token)}` +
        `\n\nIt works once and expires in 30 minutes. If you didn't ask for this, ignore this email;` +
        ` your password won't change.${signOff}`,
    }),

  passwordChanged: (to: string, name: string) =>
    sendMail({
      to,
      subject: `Your ${env.APP_NAME} password was changed`,
      text:
        `Hi ${name},\n\nYour password was just changed and your other devices were signed out.` +
        `\n\nIf this wasn't you, reset your password now: ${env.APP_URL}/forgot-password${signOff}`,
    }),

  accountDeleted: (to: string, name: string) =>
    sendMail({
      to,
      subject: `Your ${env.APP_NAME} account was deleted`,
      text:
        `Hi ${name},\n\nYour account and study guides have been permanently deleted, as you asked.` +
        `\n\nThanks for studying with us.${signOff}`,
    }),

  mfaChanged: (to: string, name: string, enabled: boolean) =>
    sendMail({
      to,
      subject: `Two-factor sign-in was turned ${enabled ? 'on' : 'off'}`,
      text:
        `Hi ${name},\n\nTwo-factor sign-in was just turned ${enabled ? 'on' : 'off'} for your account.` +
        `\n\nIf this wasn't you, reset your password now: ${env.APP_URL}/forgot-password${signOff}`,
    }),
};
