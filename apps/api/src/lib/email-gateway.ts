import { emailProviderConfigured, sendResendEmail } from "../verify/email-keys.js";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let override: ((to: string, subject: string, text: string) => Promise<void>) | null = null;
/** Test seam. */
export function setEmailSenderForTests(fn: typeof override): void {
  override = fn;
}

export async function emailIsReady(): Promise<boolean> {
  return override ? true : emailProviderConfigured();
}

/** A plain transactional email. Throws if the provider refuses, so callers can record a failure instead of a lie. */
export async function sendPlainEmail(to: string, subject: string, text: string): Promise<void> {
  if (override) return override(to, subject, text);
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#0A0A0A">${escapeHtml(text).replace(/\n/g, "<br>")}</div>`;
  await sendResendEmail({ to: [to], subject, html, text });
}
