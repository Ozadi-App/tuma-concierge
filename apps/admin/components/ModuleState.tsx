import Link from "next/link";

/** Where a module's on/off switch used to sit on its own settings page. Switching lives in Services, in one place. */
export function ModuleState({ on, label }: { on: boolean; label?: string }) {
  return (
    <Link href="/settings/services" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-1 text-[11px] font-bold text-ink-500" title="On/off lives in Services">
      <span className={`h-2 w-2 rounded-full ${on ? "bg-emerald-500" : "bg-ink-500/50"}`} aria-hidden />
      {label ?? (on ? "On" : "Off")} · change in Services
    </Link>
  );
}
