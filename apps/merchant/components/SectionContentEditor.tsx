"use client";

import { Plus, Trash2 } from "lucide-react";
import type { StorefrontSection } from "@peebee/shared";

type Item = Record<string, any>;

/**
 * The words on a storefront section. The page builder only reordered sections before; what a visitor reads in
 * "reviews", "promises" and "FAQ" is whatever the merchant writes here — nothing is filled in for them.
 */
export function SectionContentEditor({ section, onChange }: { section: StorefrontSection; onChange: (settings: Record<string, any>) => void }) {
  const settings = section.settings ?? {};
  const items: Item[] = Array.isArray(settings.items) ? settings.items : [];
  const setItems = (next: Item[]) => onChange({ ...settings, items: next });
  const patch = (i: number, p: Item) => setItems(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  const input = "w-full rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-1.5 text-xs text-ink";

  if (section.type === "announcement") {
    return (
      <label className="block text-[11px] font-semibold text-ink-500">
        Announcement text (shown at the very top)
        <input className={`${input} mt-1`} maxLength={160} value={String(settings.text ?? "")} onChange={(e) => onChange({ ...settings, text: e.target.value })} placeholder="Free delivery this weekend" />
      </label>
    );
  }

  if (section.type === "video_spotlight") {
    return (
      <label className="block text-[11px] font-semibold text-ink-500">
        Video link (https, or a direct .mp4)
        <input className={`${input} mt-1`} maxLength={500} value={String(settings.videoUrl ?? "")} onChange={(e) => onChange({ ...settings, videoUrl: e.target.value })} placeholder="https://…" inputMode="url" />
      </label>
    );
  }

  if (section.type !== "testimonials" && section.type !== "trust_badges" && section.type !== "faq") return null;

  const limit = section.type === "trust_badges" ? 8 : 12;
  const add = () => {
    if (items.length >= limit) return;
    setItems([...items, section.type === "testimonials" ? { quote: "", author: "", rating: 5 } : section.type === "trust_badges" ? { icon: "", title: "", text: "" } : { question: "", answer: "" }]);
  };

  return (
    <div className="space-y-2 rounded-2xl bg-[rgb(var(--surface-muted))] p-3">
      <p className="text-[11px] text-ink-500">
        {section.type === "testimonials"
          ? "Add reviews you have permission to share. Visitors see exactly what you write."
          : section.type === "trust_badges"
            ? "Promises you can keep — for example your delivery time or return policy."
            : "Answers to what customers ask most."}{" "}
        A section with nothing added stays hidden.
      </p>
      {items.map((it, i) => (
        <div key={i} className="space-y-1.5 rounded-xl bg-[rgb(var(--surface-card))] p-2.5">
          {section.type === "testimonials" && (
            <>
              <textarea className={input} rows={2} maxLength={300} value={String(it.quote ?? "")} onChange={(e) => patch(i, { quote: e.target.value })} placeholder="What the customer said" />
              <div className="grid grid-cols-[1fr_5rem] gap-2">
                <input className={input} maxLength={80} value={String(it.author ?? "")} onChange={(e) => patch(i, { author: e.target.value })} placeholder="Name · area" />
                <input className={input} type="number" min={1} max={5} value={Number(it.rating ?? 5)} onChange={(e) => patch(i, { rating: Math.min(5, Math.max(1, Math.round(Number(e.target.value) || 5))) })} aria-label="Stars" />
              </div>
            </>
          )}
          {section.type === "trust_badges" && (
            <div className="grid grid-cols-[3.5rem_1fr] gap-2">
              <input className={input} maxLength={8} value={String(it.icon ?? "")} onChange={(e) => patch(i, { icon: e.target.value })} placeholder="🚚" aria-label="Icon" />
              <input className={input} maxLength={60} value={String(it.title ?? "")} onChange={(e) => patch(i, { title: e.target.value })} placeholder="Promise" />
              <span />
              <input className={input} maxLength={140} value={String(it.text ?? "")} onChange={(e) => patch(i, { text: e.target.value })} placeholder="A few words of detail (optional)" />
            </div>
          )}
          {section.type === "faq" && (
            <>
              <input className={input} maxLength={160} value={String(it.question ?? "")} onChange={(e) => patch(i, { question: e.target.value })} placeholder="Question" />
              <textarea className={input} rows={2} maxLength={600} value={String(it.answer ?? "")} onChange={(e) => patch(i, { answer: e.target.value })} placeholder="Answer" />
            </>
          )}
          <button type="button" onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        </div>
      ))}
      {items.length < limit && (
        <button type="button" onClick={add} className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-3 py-1.5 text-[11px] font-black text-ink">
          <Plus className="h-3 w-3" /> Add
        </button>
      )}
    </div>
  );
}
