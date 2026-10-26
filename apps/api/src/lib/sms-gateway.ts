import { getRawSetting } from "./settings.js";

/**
 * The one way Peebee sends a text message on behalf of a merchant or a public form.
 *
 * Honest by construction: the result says what really happened. `simulated` means no message left the building
 * (admin has the provider set to the simulator, or it is not configured); only a provider acceptance is `sent`, and
 * `failed` carries the reason. Callers must never record a simulated or failed message as delivered, nor bill for it.
 */
export type SmsResult =
  | { status: "sent"; provider: "africas_talking" | "twilio"; externalId: string | null }
  | { status: "simulated"; provider: "simulator"; externalId: null }
  | { status: "failed"; provider: "africas_talking" | "twilio"; error: string };

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
let fetchImpl: Fetch = (input, init) => fetch(input, init);
export function setSmsFetchForTests(fn: Fetch | null): void {
  fetchImpl = fn ?? ((input, init) => fetch(input, init));
}

/** Test seam: replace the whole send. */
let overrideSender: ((to: string, body: string) => Promise<SmsResult>) | null = null;
export function setSmsSenderForTests(fn: typeof overrideSender): void {
  overrideSender = fn;
}

export async function configuredSmsProvider(): Promise<"simulator" | "africas_talking" | "twilio"> {
  const raw = await getRawSetting("marketplace_sms_provider");
  return raw === "africas_talking" || raw === "twilio" ? raw : "simulator";
}

export async function smsIsReal(): Promise<boolean> {
  if (overrideSender) return true;
  const provider = await configuredSmsProvider();
  if (provider === "africas_talking") return Boolean(process.env.AFRICASTALKING_USERNAME && process.env.AFRICASTALKING_API_KEY);
  if (provider === "twilio") return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
  return false;
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  if (overrideSender) return overrideSender(to, body);
  const provider = await configuredSmsProvider();

  if (provider === "africas_talking") {
    const username = process.env.AFRICASTALKING_USERNAME;
    const key = process.env.AFRICASTALKING_API_KEY;
    if (!username || !key) return { status: "failed", provider, error: "Africa's Talking is selected but its credentials are not set." };
    const base = username === "sandbox" ? "https://api.sandbox.africastalking.com" : "https://api.africastalking.com";
    try {
      const res = await fetchImpl(`${base}/version1/messaging`, {
        method: "POST",
        headers: { apiKey: key, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({ username, to, message: body }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return { status: "failed", provider, error: `Provider rejected the message (${res.status}).` };
      const data = (await res.json()) as { SMSMessageData?: { Recipients?: Array<{ status?: string; messageId?: string }> } };
      const ok = data.SMSMessageData?.Recipients?.find((r) => r.status === "Success");
      return ok ? { status: "sent", provider, externalId: ok.messageId ?? null } : { status: "failed", provider, error: "Provider did not accept the recipient." };
    } catch (err) {
      return { status: "failed", provider, error: err instanceof Error ? err.message.slice(0, 200) : "Could not reach the provider." };
    }
  }

  if (provider === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;
    if (!sid || !token || !from) return { status: "failed", provider, error: "Twilio is selected but its credentials are not set." };
    try {
      const res = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return { status: "failed", provider, error: `Provider rejected the message (${res.status}).` };
      const data = (await res.json()) as { sid?: string };
      return { status: "sent", provider, externalId: data.sid ?? null };
    } catch (err) {
      return { status: "failed", provider, error: err instanceof Error ? err.message.slice(0, 200) : "Could not reach the provider." };
    }
  }

  return { status: "simulated", provider: "simulator", externalId: null };
}
