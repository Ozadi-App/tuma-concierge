import { Check } from "lucide-react";

type StopLike = { position: number; area: string | null; address: string | null; status: "pending" | "arrived" | "done" };

/** Stops on the way, for the order tracking page and the shared trip page. */
export function RideStopsList({ stops, className = "" }: { stops: StopLike[]; className?: string }) {
  if (!stops.length) return null;
  const next = stops.find((s) => s.status !== "done")?.position;
  return (
    <ol className={`space-y-1.5 ${className}`} aria-label={`${stops.length} stop${stops.length === 1 ? "" : "s"} on the way`}>
      {stops.map((s) => (
        <li key={s.position} className="flex items-center gap-2 text-sm text-ink-500">
          <span
            className={`ride-stop-chip__n flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${s.status === "done" ? "is-done" : ""}`}
            aria-hidden
          >
            {s.status === "done" ? <Check className="h-3 w-3" strokeWidth={3} /> : s.position}
          </span>
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold text-ink">Stop {s.position}</span> · {[s.area, s.address].filter(Boolean).join(" · ") || "—"}
          </span>
          <span className="shrink-0 text-xs font-bold">
            {s.status === "done" ? "Done" : s.status === "arrived" ? <span className="text-green">Rider is here</span> : s.position === next ? "Next" : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
