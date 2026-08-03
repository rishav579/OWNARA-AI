/**
 * BIHARI AI — Email Service
 *
 * Sends transactional emails via SMTP (SendGrid, AWS SES, or any SMTP relay).
 *
 * Configuration via environment variables:
 *   SMTP_HOST      — relay host (e.g. smtp.sendgrid.net)
 *   SMTP_PORT      — relay port (e.g. 587)
 *   SMTP_USER      — relay username (e.g. apikey for SendGrid)
 *   SMTP_PASS      — relay password (e.g. SendGrid API key)
 *   SMTP_FROM      — from email address (e.g. noreply@bihari.ai)
 *   SMTP_FROM_NAME — from display name (e.g. "BIHARI AI")
 *
 * If SMTP_HOST is not set, the service operates in "log mode" — emails are
 * logged to the console instead of sent. This allows development without
 * an email provider.
 */

import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null; // Log mode — no SMTP configured
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const t = getTransporter();
  const fromEmail = process.env.SMTP_FROM || "noreply@bihari.ai";
  const fromName = process.env.SMTP_FROM_NAME || "BIHARI AI";

  if (!t) {
    console.log("[Email Service] LOG MODE — email not sent (SMTP not configured)");
    console.log(`  To: ${params.to}`);
    console.log(`  Subject: ${params.subject}`);
    console.log(`  Body: ${params.body.substring(0, 200)}...`);
    return { sent: false, error: "SMTP not configured — email logged to console" };
  }

  try {
    const info = await t.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: params.to,
      subject: params.subject,
      text: params.body,
      replyTo: params.replyTo || fromEmail,
    });

    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Email Service] Failed to send email:", message);
    return { sent: false, error: message };
  }
}

export async function sendReminderEmail(params: {
  to: string;
  customerName: string;
  subject: string;
  body: string;
}): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  return sendEmail({
    to: params.to,
    subject: params.subject,
    body: params.body,
  });
}
