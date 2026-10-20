import type { OnboardingSettings } from "@peebee/shared";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { hasTable } from "../lib/schema.js";
import { notifyUser } from "../lib/webpush.js";
import { appBaseUrl } from "../verify/service.js";
import { onboardingSettings, secret } from "../onboarding/messaging.js";
import { sendResendEmail } from "../verify/email-keys.js";
import { getGuestSettings } from "./settings.js";

export type GuestEvent = "placed" | "paid" | "preparing" | "on_the_way" | "arrived" | "delivered";

/** The order stage that announces each event. Stages the guest has no use for (Create, Match, Fund, Handover) say nothing. */
const EVENT_FOR_STAGE: Record<string, GuestEvent> = { Shop: "preparing", Deliver: "on_the_way", Arrived: "arrived", Settle: "delivered" };

type GuestRow = { order_id: string; user_id: string; tracking_code: string; name: string; phone: string; email: string | null };

export function guestTrackUrl(code: string): string {
  return `${appBaseUrl("customer")}/guest/track?code=${encodeURIComponent(code)}`;
}
export function guestOrderUrl(orderId: string): string {
  return `${appBaseUrl("customer")}/guest/order/${orderId}`;
}

function wording(event: GuestEvent, code: string, firstName: string): { title: string; body: string } {
  switch (event) {
    case "placed": return { title: "Order received", body: `Hi ${firstName}, we have your order. Your tracking code is ${code}. Complete payment to confirm it.` };
    case "paid": return { title: "Payment received", body: `Thank you ${firstName}. Payment received for order ${code}. We are finding a rider.` };
    case "preparing": return { title: "A rider has your order", body: `A rider is collecting your order ${code}.` };
    case "on_the_way": return { title: "Your package is on its way", body: `Order ${code} is on its way to you.` };
    case "arrived": return { title: "Your rider has arrived", body: `Your rider is at your location with order ${code}. Have your delivery PIN ready.` };
    case "delivered": return { title: "Delivered", body: `Order ${code} has been delivered. Thank you for shopping with Peebee.` };
  }
}

async function claim(orderId: string, event: GuestEvent, channel: string): Promise<boolean> {
  const res = await db.execute({
    sql: "INSERT OR IGNORE INTO guest_notifications (id, order_id, event, channel, status) VALUES (?, ?, ?, ?, 'sending')",
    args: [newId("gn"), orderId, event, channel],
  });
  return res.rowsAffected > 0;
}
async function finish(orderId: string, event: GuestEvent, channel: string, error: string | null) {
  await db.execute({
    sql: "UPDATE guest_notifications SET status = ?, error = ? WHERE order_id = ? AND event = ? AND channel = ?",
    args: [error ? "failed" : "sent", error, orderId, event, channel],
  });
}

async function sendSms(to: string, message: string, s: OnboardingSettings): Promise<void> {
  const key = await secret("sms_key", "AFRICASTALKING_API_KEY");
  const base = s.smsUsername === "sandbox" ? "https://api.sandbox.africastalking.com" : "https://api.africastalking.com";
  const res = await fetch(`${base}/version1/messaging`, {
    method: "POST",
    headers: { apiKey: key, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ username: s.smsUsername, to, message }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("SMS provider rejected the message.");
  const data = (await res.json()) as { SMSMessageData?: { Recipients?: Array<{ status?: string }> } };
  if (!data.SMSMessageData?.Recipients?.some((r) => r.status === "Success")) throw new Error("SMS provider did not accept the recipient.");
}

async function sendWhatsapp(to: string, name: string, message: string, template: string, s: OnboardingSettings): Promise<void> {
  const token = await secret("whatsapp_token", "WHATSAPP_ACCESS_TOKEN");
  const res = await fetch(`https://graph.facebook.com/${s.whatsappVersion}/${s.whatsappPhoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      messaging_product: "whatsapp", to: to.replace(/^\+/, ""), type: "template",
      template: { name: template, language: { code: s.whatsappLanguage }, components: [{ type: "body", parameters: [{ type: "text", text: name }, { type: "text", text: message }] }] },
    }),
  });
  if (!res.ok) throw new Error("WhatsApp provider rejected the message.");
  const data = (await res.json()) as { messages?: Array<{ id?: string }> };
  if (!data.messages?.[0]?.id) throw new Error("WhatsApp provider did not accept the message.");
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/**
 * Tells a guest about their order on every channel the admin has switched on. Each channel is its own
 * claim in guest_notifications, so a stage repeating (or two riders acting at once) never sends twice,
 * and one channel failing never stops the others. Never throws.
 */
export async function notifyGuest(orderId: string, event: GuestEvent): Promise<void> {
  try {
    if (!(await hasTable("guest_orders")) || !(await hasTable("guest_notifications"))) return;
    const row = (await db.execute({ sql: "SELECT order_id, user_id, tracking_code, name, phone, email FROM guest_orders WHERE order_id = ?", args: [orderId] })).rows[0] as unknown as GuestRow | undefined;
    if (!row) return;
    const settings = await getGuestSettings();
    const firstName = row.name.trim().split(/\s+/)[0] || "there";
    const { title, body } = wording(event, row.tracking_code, firstName);
    const trackUrl = guestTrackUrl(row.tracking_code);
    const jobs: Array<Promise<void>> = [];
    const run = (channel: string, fn: () => Promise<void>) => {
      jobs.push((async () => {
        if (!(await claim(orderId, event, channel))) return;
        try { await fn(); await finish(orderId, event, channel, null); }
        catch (err) { await finish(orderId, event, channel, err instanceof Error ? err.message.slice(0, 200) : "failed").catch(() => {}); }
      })());
    };

    if (settings.notifyPush) run("push", () => notifyUser(row.user_id, { title, body, url: `/guest/order/${orderId}`, tag: `guest-${orderId}` }));
    if (settings.notifyChat) run("chat", async () => {
      await db.execute({
        sql: `INSERT INTO chat_messages (id, order_id, sender_id, sender_role, body, type, customer_id, rider_id)
              VALUES (?, ?, ?, 'system', ?, 'text', ?, NULL)`,
        args: [newId("msg"), orderId, row.user_id, `Peebee: ${body}`, row.user_id],
      });
    });
    if (settings.notifySms || settings.notifyWhatsapp) {
      const onboarding = await onboardingSettings();
      if (settings.notifySms) run("sms", async () => {
        if (!onboarding.providers.sms) throw new Error("SMS is not configured.");
        await sendSms(row.phone, `Peebee: ${body} Track: ${trackUrl}`, onboarding);
      });
      if (settings.notifyWhatsapp) run("whatsapp", async () => {
        if (!onboarding.providers.whatsapp || !settings.whatsappTemplate) throw new Error("WhatsApp is not configured.");
        await sendWhatsapp(row.phone, firstName, `${body} ${trackUrl}`, settings.whatsappTemplate, onboarding);
      });
    }
    if (settings.notifyEmail && row.email) run("email", async () => {
      await sendResendEmail({
        to: [row.email!], subject: `Peebee: ${title}`,
        text: `${body}\n\nTrack your order: ${trackUrl}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p><p><a href="${escapeHtml(trackUrl)}" style="background:#C9A227;color:#101828;padding:12px 22px;border-radius:24px;display:inline-block">Track my order</a></p></div>`,
      });
    });
    await Promise.all(jobs);
  } catch (err) {
    console.error("Guest notification failed:", err);
  }
}

/** Called for every order event; does nothing unless the order is a guest order and the stage is one a guest hears about. */
export async function guestStageHook(orderId: string, stage: string): Promise<void> {
  const event = EVENT_FOR_STAGE[stage];
  if (!event) return;
  await notifyGuest(orderId, event);
}
