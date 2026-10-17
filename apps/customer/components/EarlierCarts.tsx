"use client";

import { useState } from "react";
import { ChevronDown, History, X } from "lucide-react";
import { earlierCartDate, formatCartDate, useEarlierCarts } from "../lib/cart";

/** One-off notice after a stale bag was set aside when a new one started. */
export function EarlierCartNotice({ at, onDismiss }: { at: number; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-2xl border border-gold/30 bg-gold/10 px-3 py-2.5 text-xs text-ink"
    >
      <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden="true" />
      <p className="min-w-0 flex-1 leading-snug">
        Your earlier bag from {formatCartDate(at)} was saved under Earlier carts.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="-m-1 shrink-0 rounded-full p-1 text-ink-500 hover:text-ink"
        aria-label="Dismiss notice"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Earlier (set-aside) bags: retrievable, but never part of a checkout until restored or added.
 * `showNotice` shows the one-off "saved under Earlier carts" notice above the list.
 */
export function EarlierCarts({
  showNotice = true,
  showList = true,
  className = "",
}: {
  showNotice?: boolean;
  showList?: boolean;
  className?: string;
}) {
  const { carts, notice, dismissNotice, restore, addToBag, remove } = useEarlierCarts();
  const [open, setOpen] = useState(false);

  const listVisible = showList && carts.length > 0;
  if (!listVisible && !(showNotice && notice)) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {showNotice && notice && <EarlierCartNotice at={notice} onDismiss={dismissNotice} />}
      {listVisible && (
        <section className="rounded-[20px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))]">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-500">
              <History className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
              Earlier carts ({carts.length})
            </span>
            <ChevronDown className={`h-4 w-4 text-ink-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {open && (
            <ul className="space-y-2 border-t border-[var(--border-faint)] p-2.5">
              {carts.map((cart) => {
                const count = cart.items.reduce((n, i) => n + i.quantity, 0);
                const total = cart.items.reduce((n, i) => n + i.price * i.quantity, 0);
                const titles = cart.items.map((i) => i.title);
                const preview = titles.slice(0, 3).join(", ") + (titles.length > 3 ? ` +${titles.length - 3} more` : "");
                return (
                  <li key={cart.id} className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold text-ink">{formatCartDate(earlierCartDate(cart))}</span>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-ink">UGX {total.toLocaleString()}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {count} item{count === 1 ? "" : "s"}
                      {cart.reason === "left_after_checkout" ? " · left after checkout" : ""}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-500">{preview}</p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => restore(cart.id)}
                        className="rounded-full bg-gold px-3.5 py-1.5 text-[11px] font-bold text-ink-gold active:scale-95 transition"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => addToBag(cart.id)}
                        className="rounded-full border border-[var(--border-faint)] px-3.5 py-1.5 text-[11px] font-bold text-ink active:scale-95 transition"
                      >
                        Add to bag
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(cart.id)}
                        className="ml-auto px-1 text-[11px] font-semibold text-ink-500 hover:text-red-500 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
