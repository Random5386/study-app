// Sends email. Locally it goes to Mailpit (inbox at http://localhost:8025) and never
// leaves your PC. In tests, emails are kept in memory in `testOutbox` instead.
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export type SentMail = { to: string; subject: string; text: string };

/** Emails "sent" during tests, newest last. Tests read links out of these. */
export const testOutbox: SentMail[] = [];

const transporter =
  env.NODE_ENV === 'test'
    ? nodemailer.createTransport({ jsonTransport: true })
    : nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: false });

export async function sendMail(mail: SentMail) {
  if (env.NODE_ENV === 'test') {
    testOutbox.push(mail);
    return;
  }
  await transporter.sendMail({
    from: `"${env.APP_NAME}" <no-reply@studyapp.local>`,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
  });
}
