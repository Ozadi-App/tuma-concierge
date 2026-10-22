"use client";

import type { ReactNode } from "react";

/** Building blocks for the Creator Studio. Fields are one solid colour edge to edge (the `field-box` rule). */
export function Card({ title, hint, children, className = "" }: { title?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`space-y-3 rounded-[28px] bg-[rgb(var(--surface-card))] p-5 shadow-sm ${className}`}>
      {title && <div><h2 className="text-base font-bold text-ink">{title}</h2>{hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}</div>}
      {children}
    </section>
  );
}

export function TextField({ id, label, hint, value, onChange, type = "text", ...rest }: { id: string; label: string; hint?: string; value: string | number; onChange: (v: string) => void; type?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "id" | "type">) {
  return (
    <label htmlFor={id} className="block text-xs font-bold text-ink-500">
      {label}
      <span className="field-box mt-1 flex items-center rounded-2xl px-4">
        <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-12 w-full text-base font-normal text-ink outline-none" {...rest} />
      </span>
      {hint && <span className="mt-1 block text-[11px] font-normal text-ink-500">{hint}</span>}
    </label>
  );
}

export function TextArea({ id, label, hint, value, onChange, rows = 4, ...rest }: { id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value" | "id">) {
  return (
    <label htmlFor={id} className="block text-xs font-bold text-ink-500">
      {label}
      <span className="field-box mt-1 flex rounded-2xl px-4 py-3">
        <textarea id={id} value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className="w-full resize-none text-base font-normal text-ink outline-none" {...rest} />
      </span>
      {hint && <span className="mt-1 block text-[11px] font-normal text-ink-500">{hint}</span>}
    </label>
  );
}

export function Button({ children, onClick, disabled, variant = "gold", type = "button", className = "" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: "gold" | "plain" | "danger"; type?: "button" | "submit"; className?: string }) {
  const cls = variant === "gold" ? "bg-gold text-ink-gold" : variant === "danger" ? "bg-red-50 text-red-700" : "bg-[rgb(var(--surface-muted))] text-ink";
  return <button type={type} onClick={onClick} disabled={disabled} className={`min-h-12 rounded-full px-6 text-sm font-bold transition active:scale-[0.98] disabled:opacity-50 ${cls} ${className}`}>{children}</button>;
}

export function Notice({ tone, children }: { tone: "error" | "ok" | "info"; children: ReactNode }) {
  const cls = tone === "error" ? "bg-red-50 text-red-700" : tone === "ok" ? "bg-green/10 text-green" : "bg-gold/10 text-ink";
  return <p role={tone === "error" ? "alert" : "status"} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${cls}`}>{children}</p>;
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-gold text-ink-gold" : "bg-[rgb(var(--surface-muted))] text-ink"}`}>{children}</button>;
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3"><p className="text-lg font-extrabold text-ink">{value}</p><p className="text-xs text-ink-500">{label}</p></div>;
}
