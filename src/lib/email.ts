// ============================================================================
// QCLink — Transactional Email Notifications
// Supports Gmail SMTP (Nodemailer), Resend, and local dev console fallback.
// ============================================================================

import nodemailer from 'nodemailer';
import { Resend } from 'resend';

let resendInstance: Resend | null = null;
let smtpTransporter: nodemailer.Transporter | null = null;
let hasWarnedEmailFallback = false;

export function isSMTPConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function isEmailConfigured(): boolean {
  return isSMTPConfigured() || !!process.env.EMAIL_PROVIDER_API_KEY;
}

function getSMTPTransporter(): nodemailer.Transporter {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS?.replace(/\s+/g, ''), // clean any spaces
      },
    });
  }
  return smtpTransporter;
}

function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.EMAIL_PROVIDER_API_KEY);
  }
  return resendInstance;
}

function getFromAddress(): string {
  if (isSMTPConfigured()) {
    return process.env.SMTP_FROM || `QCLink <${process.env.SMTP_USER}>`;
  }
  return process.env.EMAIL_FROM_ADDRESS || 'QCLink Notifications <onboarding@resend.dev>';
}

function getAppUrl(): string {
  return process.env.APP_URL || 'http://localhost:3000';
}

/**
 * Centralized email dispatcher handling Gmail SMTP, Resend, and local dev console logging.
 */
async function dispatchEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
  textSummary?: string;
}): Promise<void> {
  const { to, subject, html, textSummary } = options;

  if (isSMTPConfigured()) {
    try {
      const transport = getSMTPTransporter();
      const recipients = Array.isArray(to) ? to.join(', ') : to;
      const info = await transport.sendMail({
        from: getFromAddress(),
        to: recipients,
        subject,
        html,
      });
      console.log(
        `[QCLink Email Success] Sent via Gmail SMTP to ${JSON.stringify(to)} (ID: ${info.messageId})`
      );
    } catch (error) {
      console.error(
        `[QCLink Email Error] Gmail SMTP failed to send email to ${JSON.stringify(to)}:`,
        error
      );
    }
  } else if (process.env.EMAIL_PROVIDER_API_KEY) {
    const resend = getResend();
    const result = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject,
      html,
    });

    if (result.error) {
      console.error(
        `[QCLink Email Error] Resend failed to send email to ${JSON.stringify(to)}:`,
        result.error
      );
    } else {
      console.log(
        `[QCLink Email Success] Email sent via Resend to ${JSON.stringify(to)} (ID: ${result.data?.id})`
      );
    }
  } else {
    // Local development fallback
    if (!hasWarnedEmailFallback) {
      console.warn(
        '[QCLink] Email provider not configured — using console log output. This should only happen in local development.'
      );
      hasWarnedEmailFallback = true;
    }

    const recipients = Array.isArray(to) ? to.join(', ') : to;
    console.log(`\n================== [QCLink DEV EMAIL] ==================`);
    console.log(`To:      ${recipients}`);
    console.log(`Subject: ${subject}`);
    console.log(`--------------------------------------------------------`);
    console.log(textSummary || html);
    console.log(`========================================================\n`);
  }
}

/**
 * Base email layout wrapper with clean corporate styling.
 */
function emailLayout(title: string, contentHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #0f172a; padding: 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px; }
    .body { padding: 32px 24px; line-height: 1.6; font-size: 15px; }
    .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 20px 0; }
    .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>QCLink</h1>
    </div>
    <div class="body">
      ${contentHtml}
    </div>
    <div class="footer">
      This is an automated notification from QCLink Quality Control Management.
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 1. Tell a user an admin created their account. The password is shared by
 *    the admin out of band — never emailed — and "Forgot password" lets the
 *    user set their own.
 */
export async function sendAccountCreatedEmail(
  userEmail: string,
  userName: string,
  companyName: string
): Promise<void> {
  try {
    const loginUrl = `${getAppUrl()}/login`;
    const forgotUrl = `${getAppUrl()}/forgot-password`;

    const html = emailLayout(
      'Your QCLink Account',
      `
      <h2>Welcome to QCLink</h2>
      <p>Hello ${escapeHtml(userName)},</p>
      <p>A QCLink account has been created for you under <strong>${escapeHtml(companyName)}</strong>.</p>
      <p>Sign in with this email address and the password your administrator shared with you, or set your own password using <a href="${forgotUrl}">Forgot password</a>.</p>
      <p style="text-align: center;">
        <a href="${loginUrl}" class="button">Log In to QCLink</a>
      </p>
      `
    );

    const textSummary = `Hello ${userName},\nA QCLink account has been created for you under ${companyName}. Log in at ${loginUrl}, or set your own password at ${forgotUrl}.`;

    await dispatchEmail({
      to: userEmail,
      subject: 'Your QCLink account is ready',
      html,
      textSummary,
    });
  } catch (error) {
    console.error(`Failed to send account-created email to ${userEmail}:`, error);
  }
}

/**
 * 2. Notify a user that their account was approved.
 */
export async function sendApprovalEmail(
  userEmail: string,
  userName: string
): Promise<void> {
  try {
    const loginUrl = `${getAppUrl()}/login`;

    const html = emailLayout(
      'Account Approved',
      `
      <h2>Welcome to QCLink</h2>
      <p>Hello ${userName},</p>
      <p>Your QCLink account request has been approved by an administrator. You can now log in to the portal and access the system.</p>
      <p style="text-align: center;">
        <a href="${loginUrl}" class="button">Log In to QCLink</a>
      </p>
      `
    );

    const textSummary = `Hello ${userName},\nYour QCLink account has been approved. You can now log in at: ${loginUrl}`;

    await dispatchEmail({
      to: userEmail,
      subject: 'Your QCLink account has been approved',
      html,
      textSummary,
    });
  } catch (error) {
    console.error(`Failed to send approval email to ${userEmail}:`, error);
  }
}

/**
 * 3. Notify a user that their account request was not approved.
 */
export async function sendRejectionEmail(
  userEmail: string,
  userName: string
): Promise<void> {
  try {
    const html = emailLayout(
      'Account Request Status',
      `
      <h2>Account Request Update</h2>
      <p>Hello ${userName},</p>
      <p>Your QCLink account registration request was not approved at this time.</p>
      <p>If you believe this was an error, please contact your organization's QCLink administrator directly.</p>
      `
    );

    const textSummary = `Hello ${userName},\nYour QCLink account registration request was not approved at this time.`;

    await dispatchEmail({
      to: userEmail,
      subject: 'QCLink Account Registration Update',
      html,
      textSummary,
    });
  } catch (error) {
    console.error(`Failed to send rejection email to ${userEmail}:`, error);
  }
}

/**
 * 4. Send password reset link with raw token to user.
 */
export async function sendPasswordResetEmail(
  userEmail: string,
  userName: string,
  rawToken: string
): Promise<void> {
  try {
    const resetUrl = `${getAppUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;

    const html = emailLayout(
      'Reset Your Password',
      `
      <h2>Password Reset Request</h2>
      <p>Hello ${userName},</p>
      <p>We received a request to reset your password for QCLink. Click the button below to choose a new password:</p>
      <p style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </p>
      <p style="font-size: 13px; color: #64748b;">
        This link is valid for 30 minutes and can only be used once. If you did not request a password reset, you can safely ignore this email — your account remains secure.
      </p>
      `
    );

    const textSummary = `Hello ${userName},\nWe received a request to reset your password.\nReset URL: ${resetUrl}\n(Valid for 30 minutes, single use)`;

    await dispatchEmail({
      to: userEmail,
      subject: 'Reset your QCLink password',
      html,
      textSummary,
    });
  } catch (error) {
    console.error(`Failed to send password reset email to ${userEmail}:`, error);
  }
}
