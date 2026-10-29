"use client";
import { useEffect, useRef } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { FEATURE_BY_ID } from "../lib/features";
import { useFocusTrap } from "../lib/focus";

/** A compact pop-up for one feature: bottom sheet on phone, centred card on desktop. */
export function FeatureSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const f = id ? FEATURE_BY_ID[id] : null;
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(f);
  if (f) last.current = f;
  const shown = last.current;
  useFocusTrap(ref, !!f, ".fs-close");
  useEffect(() => {
    if (!f) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [f, onClose]);
  return (
    <div className="fs" data-open={!!f || undefined} aria-hidden={!f} inert={!f}>
      <button type="button" className="fs-scrim" aria-label="Close" tabIndex={-1} onClick={onClose} />
      {shown && (
        <div ref={ref} className="fs-card" role="dialog" aria-modal="true" aria-labelledby="fs-title">
          <span className="fs-grip" aria-hidden />
          <button type="button" className="fs-close" onClick={onClose} aria-label="Close"><X size={18} aria-hidden /></button>
          <span className="fs-ic"><shown.icon size={22} aria-hidden /></span>
          <p className="fs-kicker">Feature</p>
          <h2 id="fs-title" className="fs-title">{shown.title}</h2>
          <p className="fs-text">{shown.text}</p>
          {shown.action && <a href={shown.action.href} className="fs-act">{shown.action.label} <ArrowUpRight size={15} aria-hidden /></a>}
        </div>
      )}
    </div>
  );
}

/** A small tile grid of features. Lighter than the service rows on purpose. */
export function FeatureTiles({ items, onOpen, title = "Also in the app" }: { items: { id: string; icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>; title: string }[]; onOpen: (id: string) => void; title?: string }) {
  if (!items.length) return null;
  return (
    <section className="ft" aria-label={title}>
      <p className="ft-kicker">{title}</p>
      <ul className="ft-grid">
        {items.map((f) => (
          <li key={f.id}>
            <button type="button" className="ft-tile" onClick={() => onOpen(f.id)} aria-haspopup="dialog">
              <f.icon size={16} aria-hidden />
              <span>{f.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
