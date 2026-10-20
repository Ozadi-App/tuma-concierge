import { createApiClient } from "@peebee/shared";

/** Guest orders this browser placed. Each token works on its own order only, so it is kept apart from the sign-in token. */
const KEY = "peebee_guest_orders";

export type GuestSession = { orderId: string; trackingCode: string; token: string; item?: string; phone?: string };

export function loadGuestSessions(): GuestSession[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as GuestSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGuestSession(session: GuestSession) {
  try {
    const rest = loadGuestSessions().filter((s) => s.orderId !== session.orderId);
    window.localStorage.setItem(KEY, JSON.stringify([session, ...rest].slice(0, 10)));
  } catch {}
}

export function findGuestSession(orderId: string): GuestSession | null {
  return loadGuestSessions().find((s) => s.orderId === orderId) ?? null;
}

export function forgetGuestSession(orderId: string) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(loadGuestSessions().filter((s) => s.orderId !== orderId)));
  } catch {}
}

/** An API client that acts as the guest on one order. A refused token never signs anyone out or redirects. */
export function guestClient(token: string) {
  return createApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000",
    getToken: () => token,
  });
}

/** "PB-ab12" typed loosely becomes the code as shown on receipts. */
export function tidyCode(value: string): string {
  const s = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.startsWith("PB") ? `PB-${s.slice(2, 10)}` : s.slice(0, 10);
}

/** The stage names in plain words for someone with no account. */
export function guestStageText(stage: string, paid: boolean): { step: number; label: string; detail: string } {
  if (stage === "Cancelled") return { step: -1, label: "Cancelled", detail: "This order was cancelled." };
  if (!paid && ["Create", "Match", "Fund"].includes(stage)) return { step: 0, label: "Waiting for payment", detail: "Complete the payment to confirm your order." };
  if (["Create", "Match", "Fund"].includes(stage)) return { step: 1, label: "Finding your rider", detail: "Payment received. We are finding a rider for you." };
  if (stage === "Shop") return { step: 2, label: "Rider collecting your order", detail: "A rider is picking up your order." };
  if (stage === "Deliver") return { step: 3, label: "On its way", detail: "Your package is on its way to you." };
  if (stage === "Arrived" || stage === "Handover") return { step: 4, label: "Rider has arrived", detail: "Meet your rider and share your delivery PIN." };
  return { step: 5, label: "Delivered", detail: "Your order has been delivered." };
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function guestAlertsSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!VAPID_PUBLIC_KEY;
}

function keyBytes(base64: string): Uint8Array {
  const raw = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
}

/** Asks this browser for permission and registers it for the order's delivery alerts. */
export async function enableGuestAlerts(token: string): Promise<boolean> {
  if (!guestAlertsSupported()) return false;
  try {
    if ((await Notification.requestPermission()) !== "granted") return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = (await registration.pushManager.getSubscription())
      ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY as string) as BufferSource }));
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
    await guestClient(token).subscribePush({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
    return true;
  } catch {
    return false;
  }
}
