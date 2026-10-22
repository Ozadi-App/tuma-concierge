import { db } from "../db/client.js";
import type { ChannelsConfig } from "@peebee/shared";
import type { Row } from "./common.js";

export type AccessReason = "free" | "owner" | "member" | "unlocked" | "locked_members" | "locked_pay_per_view" | "locked_sign_in";

export type Entitlement = { allowed: boolean; reason: AccessReason };

type PostAccessFields = { id: string; access: string; author_id: string; publisher_type: string; publisher_id: string; min_tier_id: string | null };

/** The active membership this person holds in a channel, if any. */
export async function activeSubscription(userId: string, channelId: string): Promise<Row | null> {
  const res = await db.execute({
    sql: `SELECT s.*, t.price_ugx AS tier_price FROM channel_subscriptions s JOIN channel_tiers t ON t.id = s.tier_id
          WHERE s.user_id = ? AND s.channel_id = ? AND s.status IN ('active', 'cancelled') AND s.current_period_end > datetime('now')
          ORDER BY t.price_ugx DESC LIMIT 1`,
    args: [userId, channelId],
  });
  return (res.rows[0] as Row | undefined) ?? null;
}

/** Whether this viewer may see a post's full content. Locked content is decided here, on the server, never by the app. */
export async function entitlement(post: PostAccessFields, viewerId: string | null, cfg: ChannelsConfig): Promise<Entitlement> {
  if (post.access === "free") return { allowed: true, reason: "free" };
  if (viewerId && post.author_id === viewerId) return { allowed: true, reason: "owner" };
  if (!viewerId) return { allowed: false, reason: "locked_sign_in" };
  if (post.publisher_type !== "channel") return { allowed: false, reason: post.access === "members" ? "locked_members" : "locked_pay_per_view" };

  const sub = await activeSubscription(viewerId, post.publisher_id);
  if (sub) {
    let tierOk = true;
    if (post.min_tier_id && post.access === "members") {
      const need = (await db.execute({ sql: "SELECT price_ugx FROM channel_tiers WHERE id = ?", args: [post.min_tier_id] })).rows[0] as Row | undefined;
      tierOk = !need || Number(sub.tier_price) >= Number(need.price_ugx);
    }
    if (post.access === "members" && tierOk) return { allowed: true, reason: "member" };
    if (post.access === "pay_per_view" && cfg.monetization.membersGetPayPerViewFree) return { allowed: true, reason: "member" };
  }
  if (post.access === "pay_per_view") {
    const unlocked = (await db.execute({ sql: "SELECT 1 FROM post_unlocks WHERE post_id = ? AND user_id = ?", args: [post.id, viewerId] })).rows[0];
    if (unlocked) return { allowed: true, reason: "unlocked" };
  }
  return { allowed: false, reason: post.access === "members" ? "locked_members" : "locked_pay_per_view" };
}
