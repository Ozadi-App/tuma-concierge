/**
 * WhatsApp Business (Meta Cloud API) — delivery for phone verification codes.
 *
 * Reuses the WhatsApp credentials Admin already keeps under Onboarding (phone number ID, access token, API
 * version). Verification needs its own approved *authentication*-category template, since WhatsApp only lets
 * a business open a conversation with an approved template. The template has one body variable (the code) and
 * the standard "copy code" button. Admin turns this on and names the template; SMS stays the fallback.
 */
import { onboardingSettings, secret } from "../onboarding/messaging.js";

/** True when Admin has switched WhatsApp verification on and every credential it needs is present. */
export async function isWhatsappVerificationReady(): Promise<boolean> {
  const s = await onboardingSettings();
  return s.verifyWhatsappEnabled && !!s.verifyWhatsappTemplate && !!s.whatsappPhoneId && s.whatsappTokenSet;
}

export async function sendVerificationWhatsapp(to: string, code: string): Promise<void> {
  const s = await onboardingSettings();
  const token = await secret("whatsapp_token", "WHATSAPP_ACCESS_TOKEN");
  const res = await fetch(`https://graph.facebook.com/${s.whatsappVersion}/${s.whatsappPhoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: {
        name: s.verifyWhatsappTemplate,
        language: { code: s.verifyWhatsappLanguage },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp send failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { messages?: Array<{ id?: string }> };
  if (!data.messages?.[0]?.id) throw new Error("WhatsApp provider did not accept the message.");
}
