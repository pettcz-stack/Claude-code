import nodemailer from 'nodemailer';
import { config, smtpEnabled } from '../config.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transporter;
}

/** Odešle e-mail (pokud je SMTP nastaveno). */
export async function sendMail(to: string[], subject: string, html: string): Promise<void> {
  if (!smtpEnabled() && to.length === 0) return;
  if (config.smtp.host.length === 0 || to.length === 0) return;
  await getTransporter().sendMail({ from: config.smtp.from, to: to.join(','), subject, html });
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
