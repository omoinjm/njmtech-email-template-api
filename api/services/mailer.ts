import nodemailer from 'nodemailer';
import type { AppConfig, ClientConfig, EmailMode } from '../config/types';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  fromName: string;
}

function resolveEmailMode(appConfig: AppConfig): EmailMode {
  return appConfig.deployment.emailMode;
}

export function shouldSendEmail(appConfig: AppConfig, email: unknown): boolean {
  const mode = resolveEmailMode(appConfig);
  if (mode === 'render') return false;
  if (!email || typeof email !== 'string' || email.trim() === '') return false;
  if (mode === 'send' && !process.env.SMTP_HOST) {
    throw new Error('EMAIL_MODE=send requires SMTP configuration');
  }
  if (mode === 'auto') {
    return Boolean(process.env.SMTP_HOST);
  }
  return true;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"${options.fromName}" <${process.env.FROM_EMAIL}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}

export function getFromName(clientConfig: ClientConfig): string {
  return clientConfig.defaultLocals.fromName || process.env.FROM_NAME || 'NJMTech';
}
