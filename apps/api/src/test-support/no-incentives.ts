import { setSetting } from "../lib/settings.js";

/**
 * Rider incentives (Admin → Offers) pay a peak-hour boost on rides at certain times of day. Tests that check an exact rider or
 * driver payout turn them off, so they give the same answer at any hour instead of failing during the evening rush.
 */
export async function turnOffIncentives(): Promise<void> {
  await setSetting("incentives_config", JSON.stringify({ enabled: false }));
}
