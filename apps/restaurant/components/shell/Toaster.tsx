"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";

type Toast = { id: number; tone: "success" | "error"; text: string };
const listeners = new Set<(t: Toast) => void>();
let seq = 0;

/** Fire a short status message, e.g. after a settings save. */
export function toast(text: string, tone: Toast["tone"] = "success") {
  const t = { id: ++seq, tone, text };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const add = (t: Toast) => {
      setItems((list) => [...list.slice(-2), t]);
      window.setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), 3200);
    };
    listeners.add(add);
    return () => { listeners.delete(add); };
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:left-[264px]">
      {items.map((t) => (
        <div key={t.id} role="status" className={`rs-toast pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${t.tone === "error" ? "is-error" : ""}`}>
          {t.tone === "error" ? <CircleAlert className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4 text-gold" aria-hidden />}
          {t.text}
        </div>
      ))}
    </div>
  );
}
