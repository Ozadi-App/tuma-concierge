"use client";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import type { PQ } from "../lib/partner-questions";

/** Exclusive accordion: opening one question closes the others. */
export function PartnerQuestions({ items }: { items: PQ[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const base = useId();
  const btns = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = items.length;
    const go = (j: number) => { e.preventDefault(); btns.current[(j + n) % n]?.focus(); };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(n - 1);
  };

  return (
    <div className="pq">
      {items.map((it, i) => {
        const isOpen = open === i;
        const hid = `${base}-h${i}`, pid = `${base}-p${i}`;
        return (
          <div key={it.q} className="pq-item" data-open={isOpen || undefined}>
            <h3 className="pq-h">
              <button
                ref={(el) => { btns.current[i] = el; }}
                id={hid} type="button" className="pq-btn"
                aria-expanded={isOpen} aria-controls={pid}
                onClick={() => setOpen(isOpen ? null : i)}
                onKeyDown={(e) => onKey(e, i)}
              >
                <span>{it.q}</span>
                <ChevronDown className="pq-chev" size={18} aria-hidden />
              </button>
            </h3>
            <div id={pid} role="region" aria-labelledby={hid} className="pq-panel" inert={!isOpen}>
              <div className="pq-panel-in"><p>{it.a}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
