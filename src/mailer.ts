import { config, mailConfigured } from "./config";
import { recordError } from "./errorLog";

/**
 * Outbound email, used only for password resets.
 *
 * Resend's HTTP API is the whole implementation deliberately: it needs one
 * `fetch` and no dependency, where SMTP would mean adding a client library and
 * finding somewhere to run it. If no key is configured the app doesn't
 * pretend to send anything — routes/auth.ts falls back to Google sign-in as
 * the recovery path and says so, rather than showing a "check your inbox"
 * message for mail that will never arrive.
 */

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export function canSendMail(): boolean {
  return mailConfigured;
}

export async function sendMail(mail: Mail): Promise<boolean> {
  if (!config.RESEND_API_KEY) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.MAIL_FROM,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
      }),
    });

    if (!res.ok) {
      await recordError("mail.send", new Error(`Resend returned ${res.status}: ${await res.text()}`));
      return false;
    }
    return true;
  } catch (error) {
    await recordError("mail.send", error);
    return false;
  }
}
