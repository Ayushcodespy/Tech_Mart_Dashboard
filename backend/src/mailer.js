import nodemailer from 'nodemailer';

import { settings } from './config.js';
import { AppError } from './errors.js';

const isMailConfigured = () =>
  Boolean(settings.smtpHost && settings.smtpPort && settings.smtpUsername && settings.smtpPassword && settings.smtpFromEmail);

const transporter = () => {
  if (!isMailConfigured()) {
    throw new AppError(500, 'SMTP is not configured');
  }

  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpUseSsl,
    requireTLS: settings.smtpUseTls,
    auth: {
      user: settings.smtpUsername,
      pass: settings.smtpPassword,
    },
  });
};

const fromAddress = () => {
  const name = settings.smtpFromName || settings.storeName;
  return `"${name}" <${settings.smtpFromEmail}>`;
};

export const sendPasswordResetEmail = async ({ email, fullName, code }) => {
  const appName = settings.storeName || 'TechMart';
  const minutes = settings.passwordResetCodeExpireMinutes;

  await transporter().sendMail({
    from: fromAddress(),
    to: email,
    subject: `${appName} password reset code`,
    text: [
      `Hello ${fullName || 'there'},`,
      '',
      `Your ${appName} password reset code is: ${code}`,
      `This code expires in ${minutes} minutes.`,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2>${appName} password reset</h2>
        <p>Hello ${fullName || 'there'},</p>
        <p>Your password reset code is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>
        <p>This code expires in ${minutes} minutes.</p>
        <p style="color:#64748b">If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
};
