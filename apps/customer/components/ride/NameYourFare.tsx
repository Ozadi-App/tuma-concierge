"use client";

import { HandCoins } from "lucide-react";
import { useId } from "react";
import { formatUgx } from "../../lib/ride-home";

export type FareBand = { min: number; max: number };

/** How an offer reads against the app's quote. */
export function offerTone(amount: number, quote: number): { label: string; hint: string; tone: "low" | "fair" | "quick" } {
  if (amount < quote * 0.9) return { label: "Low offer", hint: "Fewer riders accept — expect counters", tone: "low" };
  if (amount < quote) return { label: "Fair offer", hint: "Most riders accept or counter close to it", tone: "fair" };
  return { label: "Quick pickup", hint: "At or above the app fare — riders accept fast", tone: "quick" };
}

/**
 * Name your fare on the fare board (Boda only): a slider inside the fair-price
 * band the server allows around the app's quote. Off = book at the app fare.
 */
export function NameYourFare({
  on,
  onToggle,
  quote,
  band,
  value,
  onChange,
}: {
  on: boolean;
  onToggle: (on: boolean) => void;
  quote: number;
  band: FareBand;
  value: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const tone = offerTone(value, quote);
  const pct = (n: number) => ((n - band.min) / Math.max(1, band.max - band.min)) * 100;
  return (
    <section className={`ride-nyf rounded-[20px] p-3.5 ${on ? "is-on" : ""}`} aria-labelledby={`${id}-t`}>
      <div className="flex items-center gap-3">
        <span className="ride-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"><HandCoins className="h-5 w-5" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span id={`${id}-t`} className="block text-[15px] font-bold text-ink">Name your fare</span>
          <span className="block text-xs text-ink-500">{on ? "Riders accept or counter your price" : `Or book Boda at ${formatUgx(quote)}`}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Name your own fare"
          onClick={() => onToggle(!on)}
          className={`ride-switch relative h-7 w-12 shrink-0 rounded-full ${on ? "is-on" : ""}`}
        >
          <span className="ride-switch__knob absolute top-1 h-5 w-5 rounded-full" aria-hidden />
        </button>
      </div>
      {on && (
        <div className="mt-3 space-y-2">
          <div className="flex items-end justify-between gap-2">
            <output htmlFor={`${id}-r`} className="text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-ink" aria-live="polite">{formatUgx(value)}</output>
            <span className={`ride-nyf__tone is-${tone.tone} rounded-full px-2.5 py-1 text-[11px] font-bold`}>{tone.label}</span>
          </div>
          <div className="relative pt-1">
            <input
              id={`${id}-r`}
              type="range"
              min={band.min}
              max={band.max}
              step={500}
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              aria-valuetext={`${formatUgx(value)}, ${tone.label}`}
              className="ride-range w-full"
              style={{ ["--fill" as string]: `${pct(value)}%` }}
            />
            <span className="ride-nyf__quote pointer-events-none absolute top-0 h-2 w-0.5" style={{ left: `calc(${pct(quote)}% )` }} aria-hidden />
          </div>
          <div className="flex justify-between text-[11px] font-semibold text-ink-500">
            <span>{formatUgx(band.min)}</span>
            <button type="button" onClick={() => onChange(quote)} className="underline-offset-2 hover:underline">App fare {formatUgx(quote)}</button>
            <span>{formatUgx(band.max)}</span>
          </div>
          <p className="text-xs text-ink-500">{tone.hint}. You only pay once you accept a rider.</p>
        </div>
      )}
    </section>
  );
}
