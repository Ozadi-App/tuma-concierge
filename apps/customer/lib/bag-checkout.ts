/**
 * The shopping bag's checkout, one step per screen (on /cart):
 *   1. Bag      /cart                 items and their subtotal
 *   2. Delivery /cart?step=delivery   where it goes, Relay or Direct, the delivery breakdown
 *   3. Review   /cart?step=review     the money breakdown, then "Place order" → that order's pay page
 *
 * Each step is its own history entry, so the phone's Back goes one step back inside this checkout
 * instead of leaving it for whatever screen came before (another cart's checkout, for one).
 */
export type BagCheckoutStep = "bag" | "delivery" | "review";

export const BAG_CHECKOUT_STEPS: BagCheckoutStep[] = ["bag", "delivery", "review"];

export const BAG_CHECKOUT_STEP_LABEL: Record<BagCheckoutStep, string> = {
  bag: "Bag",
  delivery: "Delivery",
  review: "Review and pay",
};

export function parseBagCheckoutStep(value: string | null | undefined): BagCheckoutStep {
  return value === "delivery" || value === "review" ? value : "bag";
}

export function bagCheckoutHref(step: BagCheckoutStep): string {
  return step === "bag" ? "/cart" : `/cart?step=${step}`;
}

export function previousBagCheckoutStep(step: BagCheckoutStep): BagCheckoutStep | null {
  const i = BAG_CHECKOUT_STEPS.indexOf(step);
  return i > 0 ? BAG_CHECKOUT_STEPS[i - 1] : null;
}

/** The delivery choices made on the Delivery step, kept for this tab so Review (or a reload) uses the same. */
export type BagDeliveryChoice = {
  deliveryMode?: "rider" | "relay";
  relayLastMile: "door" | "collect" | "meet";
  relayMeetStageId: string | null;
};

const CHOICE_KEY = "peebee-bag-delivery-choice:";
const DEFAULT_CHOICE: BagDeliveryChoice = { relayLastMile: "door", relayMeetStageId: null };

function session(): Storage | null {
  try {
    return (globalThis as { sessionStorage?: Storage }).sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function readBagDeliveryChoice(owner: string): BagDeliveryChoice {
  try {
    const raw: unknown = JSON.parse(session()?.getItem(CHOICE_KEY + owner) ?? "null");
    if (!raw || typeof raw !== "object") return { ...DEFAULT_CHOICE };
    const row = raw as Partial<BagDeliveryChoice>;
    return {
      ...(row.deliveryMode === "rider" || row.deliveryMode === "relay" ? { deliveryMode: row.deliveryMode } : {}),
      relayLastMile: row.relayLastMile === "collect" || row.relayLastMile === "meet" ? row.relayLastMile : "door",
      relayMeetStageId: typeof row.relayMeetStageId === "string" && row.relayMeetStageId ? row.relayMeetStageId : null,
    };
  } catch {
    return { ...DEFAULT_CHOICE };
  }
}

export function saveBagDeliveryChoice(owner: string, choice: BagDeliveryChoice): void {
  try {
    session()?.setItem(CHOICE_KEY + owner, JSON.stringify(choice));
  } catch {}
}

export function clearBagDeliveryChoice(owner: string): void {
  try {
    session()?.removeItem(CHOICE_KEY + owner);
  } catch {}
}
