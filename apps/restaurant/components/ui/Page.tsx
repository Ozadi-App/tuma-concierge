import type { ReactNode } from "react";

/** One header pattern for every page: gold eyebrow (the nav group), title, one line, actions on the right. */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="rs-eyebrow">{eyebrow}</p>}
        <h1 className="rs-title">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Card with an optional title row, the same radius/border/shadow everywhere. */
export function Card({ id, title, description, children, className = "" }: { id?: string; title?: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`rs-card scroll-mt-24 space-y-4 ${className}`}>
      {(title || description) && (
        <div>
          {title && <h2 className="text-[15px] font-bold text-ink">{title}</h2>}
          {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Sticky save bar: sits above the bottom nav on phones, at the bottom on desktop. */
export function SaveBar({ note, children }: { note: ReactNode; children: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(96px+env(safe-area-inset-bottom))] z-20 lg:bottom-4">
      <div className="rs-savebar"><span className="text-sm text-ink-500">{note}</span>{children}</div>
    </div>
  );
}

/** Labelled text field. */
export function Field({ label, hint, required, children }: { label: string; hint?: ReactNode; required?: boolean; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-ink-500">{label}{required && <span className="text-red-500"> *</span>}</span>
      {children}
      {hint && <span className="block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}
