"use client";

import { Phone } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

const HOLD_MS = 1200;

/**
 * Press and hold to dial the emergency number — a deliberate gesture so a
 * pocket tap or a slip of the thumb can't place an emergency call. Works with
 * touch, mouse and keyboard (hold Space/Enter). A short tap explains itself.
 */
export function HoldToCall({ number, fill = false }: { number: string; /** Stretch to the width of a narrow card; the touch target stays full size. */ fill?: boolean }) {
  const [holding, setHolding] = useState(false);
  const [hint, setHint] = useState(false);
  const timer = useRef<number | null>(null);
  const started = useRef(0);
  const hintId = useId();

  const clear = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  function start() {
    if (timer.current != null) return;
    started.current = Date.now();
    setHolding(true);
    setHint(false);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      if ("vibrate" in navigator) navigator.vibrate?.(30);
      window.location.href = `tel:${number}`;
    }, HOLD_MS);
  }
  function cancel() {
    if (timer.current == null) return;
    clear();
    setHolding(false);
    if (Date.now() - started.current < HOLD_MS) setHint(true);
  }

  return (
    <div className={`flex flex-col gap-1 ${fill ? "items-stretch" : "items-end"}`}>
      <button
        type="button"
        aria-describedby={hintId}
        onPointerDown={(e) => { e.preventDefault(); start(); }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); start(); } }}
        onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") cancel(); }}
        onBlur={cancel}
        className={`ride-hold relative flex min-h-11 select-none items-center gap-2 overflow-hidden rounded-2xl text-sm font-bold text-white touch-none ${fill ? "justify-center px-3" : "px-4"} ${holding ? "is-holding" : ""}`}
        style={{ ["--hold-ms" as string]: `${HOLD_MS}ms` }}
      >
        <Phone className="h-4 w-4 shrink-0" strokeWidth={2.4} aria-hidden />
        <span className="whitespace-nowrap">Hold · call {number}</span>
        <span aria-hidden className="ride-hold__bar" />
      </button>
      <span id={hintId} role="status" className={`text-[11px] font-semibold ${hint ? "text-[rgb(var(--ride-red))]" : "sr-only"}`}>
        {hint ? "Press and hold to call" : holding ? "Keep holding to call" : `Press and hold for about a second to call ${number}`}
      </span>
    </div>
  );
}
