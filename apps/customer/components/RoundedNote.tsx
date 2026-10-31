import { roundedFromNote } from "@peebee/shared";

/**
 * A tiny gray line under a fare that rounding changed: "(rounded up from 24,600)". Shows nothing when the amount wasn't
 * rounded (an exact fare, or a minimum fare), so it only ever appears when it explains something.
 */
export function RoundedNote({ amount, from, className = "" }: { amount: number | null | undefined; from: number | null | undefined; className?: string }) {
  const note = roundedFromNote(from, amount);
  if (!note) return null;
  return <span className={`block text-[10px] font-normal leading-tight text-ink-500 opacity-70 ${className}`}>({note})</span>;
}
