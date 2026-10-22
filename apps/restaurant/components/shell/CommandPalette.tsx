"use client";

import { CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { NAV_GROUPS } from "../../lib/nav";

type Entry = { href: string; label: string; group: string; hint?: string; words: string };

/** ⌘K / Ctrl+K (or the search button): jump to any page or setting. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const g of NAV_GROUPS) for (const i of g.items) {
      out.push({ href: i.href, label: i.label, group: g.label, hint: i.hint, words: `${i.label} ${g.label} ${i.hint} ${i.keywords ?? ""}`.toLowerCase() });
      for (const a of i.anchors ?? []) out.push({ href: `${i.href}#${a.id}`, label: a.label, group: `${g.label} › ${i.label}`, words: `${a.label} ${i.label} ${a.keywords ?? ""}`.toLowerCase() });
    }
    return out;
  }, []);
  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return terms.length ? entries.filter((e) => terms.every((t) => e.words.includes(t))) : entries;
  }, [entries, query]);

  useEffect(() => { if (!open) return; setQuery(""); setActive(0); requestAnimationFrame(() => input.current?.focus()); }, [open]);
  useEffect(() => { document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" }); }, [active, listId]);
  if (!open) return null;
  const go = (e?: Entry) => { if (!e) return; onClose(); router.push(e.href); };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="rs-palette w-full max-w-xl overflow-hidden rounded-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-[var(--border-faint)] px-4">
          <Search className="h-5 w-5 text-gold" aria-hidden />
          <input
            ref={input} value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
              else if (e.key === "Escape") { e.preventDefault(); onClose(); }
            }}
            role="combobox" aria-expanded aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            placeholder="Jump to a page or setting…"
            className="rs-palette-input h-14 flex-1 text-base text-ink outline-none"
          />
          <kbd className="rs-kbd">Esc</kbd>
        </div>
        <ul id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-500">Nothing matches “{query}”.</li>}
          {results.map((r, i) => (
            <li key={r.href} id={`${listId}-${i}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(r)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${i === active ? "rs-palette-active" : ""}`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{r.label}</span>
                <span className="block truncate text-xs text-ink-500">{r.group}{r.hint ? ` · ${r.hint}` : ""}</span>
              </span>
              {i === active && <CornerDownLeft className="h-4 w-4 text-ink-500" aria-hidden />}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
