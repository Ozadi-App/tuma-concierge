"use client";

import type { ReactNode } from "react";

/** Small pieces shared by the Channels admin screens. They follow the field rule: one solid colour, edge to edge. */
export const CARD = "space-y-4 rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm";

export function Toggle({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-60 ${on ? "bg-gold" : "bg-neutral-300 dark:bg-neutral-700"}`}
    >
      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${on ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

export function SwitchRow({ title, hint, on, disabled, onChange }: { title: string; hint?: string; on: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[var(--border-faint)] pt-4">
      <div className="min-w-0">
        <span className="block text-sm font-bold text-ink">{title}</span>
        {hint && <span className="text-xs text-ink-500">{hint}</span>}
      </div>
      <Toggle on={on} disabled={disabled} onChange={onChange} label={title} />
    </div>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field-box flex flex-col rounded-2xl bg-[rgb(var(--surface-muted))] p-3">
      <label htmlFor={id} className="mb-1 text-xs font-bold text-ink-500">{label}</label>
      {children}
      {hint && <span className="mt-1 text-[10px] text-ink-500">{hint}</span>}
    </div>
  );
}

export function SectionHead({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">{icon}</div>
      <div>
        <h2 className="text-base font-bold text-ink">{title}</h2>
        {hint && <p className="text-xs text-ink-500">{hint}</p>}
      </div>
    </div>
  );
}

export function Pill({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "green" | "red" | "grey" }) {
  const cls = tone === "green" ? "bg-green/15 text-green" : tone === "red" ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" : tone === "grey" ? "bg-neutral-200 text-ink-500 dark:bg-neutral-800" : "bg-gold/15 text-gold";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${cls}`}>{children}</span>;
}

export const ugx = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;
export const when = (s: string) => new Date(`${s.replace(" ", "T")}${s.includes("Z") ? "" : "Z"}`).toLocaleString();
