/**
 * The two ways a long delivery travels, as customers see them. The API keeps
 * its values (`deliveryMode: "relay" | "rider"`); only the words are here.
 *
 * Relay: multi-leg (boda and matatu), same day delivery.
 * Direct: one rider all the way, instant delivery (under the admin's N hours).
 * The screens only say "Same day delivery" and "Instant delivery · under N hours": people want the price, not the route.
 */
export type DeliveryModeValue = "relay" | "rider";

/** The admin default for "under N hours" until the server says otherwise. */
export const DEFAULT_DIRECT_MAX_HOURS = 3;

export const deliveryModeName = (mode: DeliveryModeValue) => (mode === "relay" ? "Relay" : "Direct");

export const RELAY_SUBTITLE = "Same day delivery";

export function directSubtitle(maxHours: number | null | undefined): string {
  const hours = maxHours != null && Number.isFinite(maxHours) && maxHours >= 1 ? Math.round(maxHours) : DEFAULT_DIRECT_MAX_HOURS;
  return `Instant delivery · under ${hours} hour${hours === 1 ? "" : "s"}`;
}

export const deliveryModeSubtitle = (mode: DeliveryModeValue, directMaxHours?: number | null) =>
  mode === "relay" ? RELAY_SUBTITLE : directSubtitle(directMaxHours);

/** The money breakdown's delivery title: "Delivery · Relay" / "Delivery · Direct" where the customer chose. */
export function deliverySectionTitle(delivery: { mode: DeliveryModeValue; marketplace?: boolean }): string {
  if (delivery.mode === "relay") return "Delivery · Relay";
  return delivery.marketplace ? "Delivery · Direct" : "Delivery";
}
