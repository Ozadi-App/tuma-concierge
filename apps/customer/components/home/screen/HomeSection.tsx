import Link from "next/link";

/** Shared surface for home cards. Uses the app's existing surface, border and shadow tokens. */
export const homePanel =
  "rounded-[var(--radius-card)] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] shadow-[var(--shadow-card)]";

export function HomeSection({
  title,
  action,
  sectionId,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  sectionId?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={sectionId} data-home-section={sectionId} className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {action && (
          <Link href={action.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-ink">
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Loading, failure and empty treatments shared by wallet, orders and recent lists. */
export function HomeStatus({
  kind,
  title,
  onRetry,
  retryLabel,
}: {
  kind: "loading" | "error" | "empty";
  title: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  if (kind === "loading") {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className={`${homePanel} h-28 animate-pulse bg-[rgb(var(--surface-muted))] motion-reduce:animate-none`}
      >
        <span className="sr-only">{title}</span>
      </div>
    );
  }
  if (kind === "error") {
    return (
      <div role="alert" className={`${homePanel} space-y-3 p-4`}>
        <p className="text-base font-semibold text-ink">{title}</p>
        {onRetry && retryLabel && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center rounded-full bg-gold px-5 text-base font-bold text-ink-gold"
          >
            {retryLabel}
          </button>
        )}
      </div>
    );
  }
  return (
    <p className={`${homePanel} px-4 py-4 text-base text-ink-500`}>{title}</p>
  );
}
