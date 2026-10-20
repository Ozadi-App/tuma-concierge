import { z } from "zod";
import { getSetting, setSetting } from "../lib/settings.js";

export type GuestSettings = {
  /** Guests may buy from a shared product link without an account. */
  enabled: boolean;
  /** Offer card payment when Flutterwave is the active collection provider. */
  cardEnabled: boolean;
  maxQuantity: number;
  /** Show the "create an account with these details" checkbox. */
  suggestAccount: boolean;
  /** Anyone holding the tracking code sees a short status; off means signing in is needed to track. */
  codeStatusEnabled: boolean;
  notifyPush: boolean;
  notifyChat: boolean;
  notifySms: boolean;
  notifyEmail: boolean;
  notifyWhatsapp: boolean;
  /** Approved WhatsApp template (two body variables: name, message) used for guest delivery updates. */
  whatsappTemplate: string;
};

export const guestSettingsPatch = z.object({
  enabled: z.boolean(),
  cardEnabled: z.boolean(),
  maxQuantity: z.number().int().min(1).max(50),
  suggestAccount: z.boolean(),
  codeStatusEnabled: z.boolean(),
  notifyPush: z.boolean(),
  notifyChat: z.boolean(),
  notifySms: z.boolean(),
  notifyEmail: z.boolean(),
  notifyWhatsapp: z.boolean(),
  whatsappTemplate: z.string().regex(/^[a-z0-9_]*$/).max(120),
}).partial();

const flag = (v: string) => v === "1";

export async function getGuestSettings(): Promise<GuestSettings> {
  const [enabled, card, qty, suggest, code, push, chat, sms, email, wa, tpl] = await Promise.all([
    getSetting("guest_checkout_enabled"), getSetting("guest_checkout_card_enabled"), getSetting("guest_checkout_max_quantity"),
    getSetting("guest_checkout_suggest_account"), getSetting("guest_checkout_code_status"),
    getSetting("guest_notify_push"), getSetting("guest_notify_chat"), getSetting("guest_notify_sms"),
    getSetting("guest_notify_email"), getSetting("guest_notify_whatsapp"), getSetting("guest_whatsapp_template"),
  ]);
  return {
    enabled: flag(enabled), cardEnabled: flag(card), maxQuantity: Math.max(1, Math.min(50, Number(qty) || 10)),
    suggestAccount: flag(suggest), codeStatusEnabled: flag(code),
    notifyPush: flag(push), notifyChat: flag(chat), notifySms: flag(sms), notifyEmail: flag(email), notifyWhatsapp: flag(wa),
    whatsappTemplate: tpl,
  };
}

export async function setGuestSettings(next: z.infer<typeof guestSettingsPatch>): Promise<void> {
  const on = (v: boolean) => (v ? "1" : "0");
  const writes: Promise<void>[] = [];
  if (next.enabled != null) writes.push(setSetting("guest_checkout_enabled", on(next.enabled)));
  if (next.cardEnabled != null) writes.push(setSetting("guest_checkout_card_enabled", on(next.cardEnabled)));
  if (next.maxQuantity != null) writes.push(setSetting("guest_checkout_max_quantity", String(next.maxQuantity)));
  if (next.suggestAccount != null) writes.push(setSetting("guest_checkout_suggest_account", on(next.suggestAccount)));
  if (next.codeStatusEnabled != null) writes.push(setSetting("guest_checkout_code_status", on(next.codeStatusEnabled)));
  if (next.notifyPush != null) writes.push(setSetting("guest_notify_push", on(next.notifyPush)));
  if (next.notifyChat != null) writes.push(setSetting("guest_notify_chat", on(next.notifyChat)));
  if (next.notifySms != null) writes.push(setSetting("guest_notify_sms", on(next.notifySms)));
  if (next.notifyEmail != null) writes.push(setSetting("guest_notify_email", on(next.notifyEmail)));
  if (next.notifyWhatsapp != null) writes.push(setSetting("guest_notify_whatsapp", on(next.notifyWhatsapp)));
  if (next.whatsappTemplate != null) writes.push(setSetting("guest_whatsapp_template", next.whatsappTemplate));
  await Promise.all(writes);
}
