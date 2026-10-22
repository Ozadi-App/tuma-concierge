import { hasTable } from "../lib/schema.js";
import { sweepCauses } from "./causes.js";
import { renewSubscriptions } from "./money.js";
import { publishDuePosts } from "./posts.js";
import { getChannelsConfig } from "./settings.js";

/** Runs from the Worker's cron heartbeat. Every step is safe to repeat. */
export async function sweepChannels(): Promise<{ published: number; renewed: number; expired: number; causesEnded: number }> {
  const out = { published: 0, renewed: 0, expired: 0, causesEnded: 0 };
  const cfg = await getChannelsConfig();
  if (!cfg.enabled || !(await hasTable("posts"))) return out;
  out.published = await publishDuePosts();
  if (cfg.monetization.enabled && (await hasTable("channel_subscriptions"))) {
    const r = await renewSubscriptions();
    out.renewed = r.renewed;
    out.expired = r.expired;
  }
  if (cfg.causes.enabled) out.causesEnded = (await sweepCauses()).ended;
  return out;
}
