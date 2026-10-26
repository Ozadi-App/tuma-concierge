import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { getMarketplaceSettings } from "../lib/settings.js";
import { hasTable } from "../lib/schema.js";
import { sendSms } from "../lib/sms-gateway.js";

export type StoreSmsType = "pos_receipt" | "order_confirmation" | "dispatch_alert" | "abandoned_cart";

export type StoreSmsOutcome = {
  logId: string;
  /** What actually happened: delivered to the provider, only simulated, or failed. */
  status: "delivered" | "simulated" | "failed";
  /** What the merchant is charged: only a message the provider accepted costs anything. */
  costUgx: number;
  externalMessageId: string | null;
  error?: string;
};

/**
 * Send a text on behalf of a store and log it honestly. A simulated or failed message is logged as such and costs the
 * merchant nothing; "delivered" always means a provider accepted it.
 */
export async function sendStoreSms(input: {
  storeId: string;
  phone: string;
  name?: string | null;
  type: StoreSmsType;
  body: string;
}): Promise<StoreSmsOutcome> {
  const settings = await getMarketplaceSettings();
  const result = await sendSms(input.phone, input.body);
  const status = result.status === "sent" ? "delivered" : result.status === "simulated" ? "simulated" : "failed";
  const costUgx = status === "delivered" ? Number(settings.eliteSmsCostPerMessageUgx) || 0 : 0;
  const externalId = result.status === "sent" ? result.externalId : null;
  const logId = newId("sms");
  if (await hasTable("store_sms_logs")) {
    await db.execute({
      sql: `INSERT INTO store_sms_logs (id, store_id, recipient_phone, recipient_name, message_type, body, status, external_message_id, cost_ugx)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [logId, input.storeId, input.phone, input.name ?? null, input.type, input.body, status, externalId, costUgx],
    });
  }
  return { logId, status, costUgx, externalMessageId: externalId, ...(result.status === "failed" ? { error: result.error } : {}) };
}
