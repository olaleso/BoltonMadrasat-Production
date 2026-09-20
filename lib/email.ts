import { env } from "cloudflare:workers";

type MailEnvironment = {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_BASE_URL?: string;
};

type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function mailEnvironment() {
  return env as unknown as MailEnvironment;
}

export function applicationOrigin(requestOrigin: string) {
  return (mailEnvironment().APP_BASE_URL ?? requestOrigin).replace(/\/$/, "");
}

export async function sendEmail(mail: Mail) {
  const current = mailEnvironment();
  const apiKey = current.RESEND_API_KEY?.trim();
  const from = current.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    throw new Error("Email delivery is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Email provider returned ${response.status}: ${detail.slice(0, 300)}`);
  }
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
