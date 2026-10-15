"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { pushSupported, subscribeToPush } from "../lib/push";

type PushState = "unsupported" | "default" | "granted" | "denied";

function readState(): PushState {
  if (typeof window === "undefined" || !pushSupported() || typeof Notification === "undefined") return "unsupported";
  return Notification.permission as PushState;
}

/** Device push notifications (new messages, order updates). Uses the same
 * subscription flow as the install-time prompt in PushNotifications. */
export function NotificationSettings() {
  const [state, setState] = useState<PushState>("unsupported");
  const [busy, setBusy] = useState(false);
  useEffect(() => setState(readState()), []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") await subscribeToPush();
      setState(readState());
    } finally {
      setBusy(false);
    }
  }

  const copy: Record<PushState, { title: string; hint: string; Icon: typeof Bell }> = {
    granted: { title: "Push notifications are on", hint: "You'll hear about new messages and order updates on this device.", Icon: BellRing },
    default: { title: "Push notifications are off", hint: "Turn them on to hear about new messages and order updates.", Icon: Bell },
    denied: { title: "Notifications are blocked", hint: "Allow notifications for Peebee in your browser or phone settings, then come back.", Icon: BellOff },
    unsupported: { title: "Not available on this device", hint: "Install Peebee to your home screen to get push notifications.", Icon: BellOff },
  };
  const { title, hint, Icon } = copy[state];

  return (
    <section className="home-card space-y-3" aria-label="Notifications">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">{title}</span>
          <span className="mt-0.5 block text-xs text-ink-500">{hint}</span>
        </span>
      </div>
      {state === "default" && (
        <button type="button" onClick={enable} disabled={busy} className="min-h-11 w-full rounded-full bg-gold px-4 text-sm font-bold text-ink-gold disabled:opacity-60">
          {busy ? "Turning on…" : "Turn on notifications"}
        </button>
      )}
    </section>
  );
}
