import { Resend } from 'resend';

// Only initialize if key is present to avoid crashing without it
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Sends an email using Resend.
 * Safely swallows errors so missing keys or rate limits don't break the app flow.
 */
export async function sendSocietyEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY is missing. Email skipped to:', options.to);
    return { success: false, reason: 'Missing API Key' };
  }

  try {
    const { data, error } = await resend.emails.send({
      // You must verify this domain in Resend.
      // If using testing mode, this will only deliver if `to` is your verified email address.
      from: 'Society Management <noreply@yourdomain.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      console.error('[Email] Failed to send email:', error);
      return { success: false, reason: error.message };
    }

    console.log(`[Email] Sent to ${options.to}`);
    return { success: true, data };
  } catch (err: any) {
    console.error('[Email] Unexpected error:', err);
    return { success: false, reason: err.message };
  }
}
