"use client";

import type { WorkJob, WorkNearby, WorkPublicSettings, WorkService } from "@peebee/shared";
import { ArrowRight, Briefcase, ChevronRight, ClipboardList, HardHat, ShieldCheck, Sparkles, WashingMachine, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import { activeHiveJob, bookingHref, MATCHING_LABEL, nearbyHeadline, schedulePresets, tradePrice, tradePriceLabel, type HiveTrade, type Matching } from "../../lib/hive-home";
import { useHireAvailability, useHomeMenu } from "../../lib/home-menu";
import { useRegisterNavPrimaryAction, type NavPrimaryAction } from "../../lib/nav-primary-action";
import { RideLiveMap } from "../ride/RideLiveMap";
import { StatusBadge } from "../work/WorkUI";
import { workFailure } from "../work/work-utils";

const TRADE: Record<HiveTrade, { icon: LucideIcon; href: string; noun: string }> = {
  clean: { icon: Sparkles, href: "/services/clean", noun: "cleaning" },
  laundry: { icon: WashingMachine, href: "/services/laundry", noun: "laundry" },
  fix: { icon: Wrench, href: "/services/fix", noun: "repair" },
};
const PERSON: Record<"workers" | "hire", { icon: LucideIcon; href: string; text: string }> = {
  workers: { icon: HardHat, href: "/services/hire/workers?segment=informal", text: "Odd jobs, someone nearby" },
  hire: { icon: Briefcase, href: "/services/hire", text: "Projects and contracts" },
};
const isTrade = (id: string): id is HiveTrade => id === "clean" || id === "laundry" || id === "fix";

type Catalog = { services: WorkService[]; settings: WorkPublicSettings };
type CatalogState = { kind: "loading" } | { kind: "ready"; data: Catalog } | { kind: "closed"; message: string } | { kind: "error" };

/** Hive home ("Hive Map"): providers by trade on a live map, and a sheet that asks what needs doing. */
export function HiveHome() {
  const router = useRouter();
  const menu = useHomeMenu();
  const availability = useHireAvailability();
  const { hive } = menu;

  const [catalog, setCatalog] = useState<CatalogState>({ kind: "loading" });
  const [nearby, setNearby] = useState<WorkNearby | null>(null);
  const [job, setJob] = useState<WorkJob | null>(null);
  const [trade, setTrade] = useState<HiveTrade | null>(null);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [matching, setMatching] = useState<Matching | null>(null);
  const [expanded, setExpanded] = useState(false);
  const asked = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .workCatalog()
      .then((data) => live && setCatalog(data.settings.enabled ? { kind: "ready", data } : { kind: "closed", message: "Hive bookings aren't open right now. Please check back soon." }))
      .catch((err) => {
        if (!live) return;
        const f = workFailure(err);
        setCatalog(f.disabled || f.upgradePending ? { kind: "closed", message: f.upgradePending ? f.message : "Hive bookings aren't open right now. Please check back soon." } : { kind: "error" });
      });
    api
      .workMyJobs()
      .then((r) => live && setJob(activeHiveJob(r.jobs)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // Ask once per ~1 km move; the answer is coarse anyway.
  const onPosition = useCallback((lat: number, lng: number) => {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    if (asked.current === key) return;
    asked.current = key;
    api
      .workNearby(lat, lng)
      .then(setNearby)
      .catch(() => setNearby(null));
  }, []);

  const settings = catalog.kind === "ready" ? catalog.data.settings : null;
  const services = catalog.kind === "ready" ? catalog.data.services : [];
  const tiles = hive.shortcuts.filter((s): s is typeof s & { id: HiveTrade } => s.enabled && isTrade(s.id) && (!settings || settings.serviceTypes.includes(s.id)));
  const people = hive.shortcuts.filter((s): s is typeof s & { id: "workers" | "hire" } => s.enabled && (s.id === "workers" ? availability.workers : s.id === "hire" ? availability.hire : false));
  const showPeople = hive.hireBanner.enabled && people.length > 0;
  const modes = (settings?.matchingModes ?? []) as Matching[];
  const effectiveMatching: Matching | null = modes.length > 1 ? (matching && modes.includes(matching) ? matching : (settings!.defaultMatching as Matching)) : null;
  const enabledTrades = tiles.map((t) => t.id);
  const pins = useMemo(() => (nearby?.pins ?? []).filter((p) => enabledTrades.includes(p.type)), [nearby, enabledTrades.join()]);
  const headline = nearbyHeadline(nearby?.counts ?? null, enabledTrades);
  const presets = useMemo(() => (settings ? schedulePresets(settings) : []), [settings]);
  const preset = when === "later" ? presets.find((p) => p.id === presetId) ?? null : null;
  const selected = trade ? tiles.find((t) => t.id === trade) ?? null : null;
  const open = catalog.kind !== "closed";

  const navAction: NavPrimaryAction | null = !open || tiles.length === 0
    ? null
    : selected
      ? {
          tone: "step",
          label: `Next: choose ${TRADE[selected.id].noun}`,
          sublabel: [when === "later" ? (preset?.label ?? "Pick a time") : "Now", effectiveMatching ? MATCHING_LABEL[effectiveMatching] : null].filter(Boolean).join(" · "),
          onClick: () => router.push(bookingHref(TRADE[selected.id].href, { matching: effectiveMatching, when, at: preset?.at })),
        }
      : { tone: "step", label: "Next: pick a service", sublabel: "Tap Clean, Laundry or Fix", disabled: true, onClick: () => {} };
  useRegisterNavPrimaryAction(navAction);

  return (
    <div className="ride-home hive-home relative overflow-hidden">
      <h1 className="sr-only">{menu.clusters.hive.label}</h1>
      <div className="absolute inset-0 isolate z-0">
        <RideLiveMap pins={pins} onPosition={onPosition} bottomInset={440} />
        <p
          data-testid="hive-nearby"
          className="pointer-events-none absolute left-3 top-3 z-[500] flex h-10 max-w-[calc(100%-5rem)] items-center gap-2 rounded-full glass-panel px-3.5 text-[13px] font-bold text-ink shadow-[var(--shadow-float-capsule)]"
        >
          {headline ? (
            <>
              <span className="ride-live-dot h-2 w-2 shrink-0 rounded-full bg-green" aria-hidden />
              <span className="truncate">{headline}</span>
            </>
          ) : nearby && !nearby.degraded ? (
            <span className="truncate">No providers online nearby yet</span>
          ) : (
            <span className="truncate">{hive.eyebrow}</span>
          )}
        </p>
      </div>

      <section aria-label="What needs doing?" className="ride-sheet absolute inset-x-0 bottom-0 z-10 flex flex-col" style={{ height: expanded ? "calc(100% - 12px)" : "min(64%, 540px)" }}>
        <button type="button" aria-label={expanded ? "Show more map" : "Expand"} aria-expanded={expanded} onClick={() => setExpanded((e) => !e)} className="flex h-6 w-full shrink-0 items-start justify-center pt-2.5">
          <span className="h-1.5 w-10 rounded-full bg-[rgb(var(--color-ink-500)/0.28)]" aria-hidden />
        </button>

        <div className="customer-nav-content-clearance min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pt-1">
          {job && (
            <Link href={`/services/work/${encodeURIComponent(job.id)}`} data-testid="hive-live-job" className="hive-live-job flex items-center gap-3 rounded-2xl p-3 transition-transform active:scale-[0.99]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
                {(() => {
                  const Icon = TRADE[job.service.type as HiveTrade]?.icon ?? ClipboardList;
                  return <Icon className="h-5 w-5" aria-hidden />;
                })()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{job.service.name}</span>
                <span className="mt-0.5 block truncate text-xs text-ink-500">{job.provider?.name ? `${job.provider.name} · ` : ""}Live job</span>
              </span>
              <StatusBadge status={job.status} />
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
            </Link>
          )}

          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">What needs doing?</h2>
            <div className="flex shrink-0 gap-2" role="group" aria-label="When">
              {(["now", "later"] as const).map((w) => (
                <button key={w} type="button" aria-pressed={when === w} onClick={() => setWhen(w)} className={`ride-chip ${when === w ? "is-on" : ""}`}>
                  {w === "now" ? "Now" : "Schedule"}
                </button>
              ))}
            </div>
          </div>

          {open && when === "later" && presets.length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Pick a time">
              {presets.map((p) => (
                <button key={p.id} type="button" aria-pressed={presetId === p.id} onClick={() => setPresetId(presetId === p.id ? null : p.id)} className={`ride-chip ${presetId === p.id ? "is-on" : ""}`}>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {!open ? (
            <p role="status" className="rounded-2xl bg-[rgb(var(--surface-muted))] p-4 text-sm text-ink-500">
              {catalog.kind === "closed" ? catalog.message : null}
            </p>
          ) : tiles.length > 0 ? (
            <div className={`grid gap-2 ${tiles.length === 1 ? "grid-cols-1" : tiles.length === 2 ? "grid-cols-2" : "grid-cols-3"}`} role="group" aria-label="Services">
              {tiles.map((t) => {
                const meta = TRADE[t.id];
                const Icon = meta.icon;
                const on = trade === t.id;
                const count = nearby?.counts[t.id] ?? 0;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    data-testid={`hive-tile-${t.id}`}
                    onClick={() => setTrade(on ? null : t.id)}
                    className={`hive-tile relative flex min-h-[112px] flex-col items-start rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${on ? "is-on border-gold" : "border-[var(--border-faint)]"}`}
                  >
                    <span className="hive-pin-dot flex h-10 w-10 items-center justify-center rounded-xl">
                      <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden />
                    </span>
                    <strong className="mt-2 text-sm">{t.label}</strong>
                    <span className="mt-0.5 text-[11px] font-semibold leading-tight text-ink-500">{catalog.kind === "loading" ? "…" : tradePriceLabel(tradePrice(services, t.id))}</span>
                    {count > 0 && <span className="absolute right-2 top-2 rounded-full bg-[rgb(var(--surface-muted))] px-1.5 text-[10px] font-bold text-ink">{count}</span>}
                  </button>
                );
              })}
            </div>
          ) : null}

          {open && effectiveMatching && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-ink-500">How should we find someone?</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Matching">
                {modes.map((m) => (
                  <button key={m} type="button" aria-pressed={effectiveMatching === m} onClick={() => setMatching(m)} className={`ride-chip ${effectiveMatching === m ? "is-on" : ""}`}>
                    {MATCHING_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {open && (
            <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
              Peebee holds your payment and only pays the provider once you confirm the job is done.
            </p>
          )}

          {showPeople && (
            <div aria-label={hive.hireBanner.title} className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-500">{hive.hireBanner.title}</p>
              <div className={`grid gap-2 ${people.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {people.map((p) => {
                  const row = PERSON[p.id];
                  const Icon = row.icon;
                  return (
                    <Link key={p.id} href={row.href} className="flex min-h-[56px] items-center gap-2.5 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-2.5 active:scale-[0.98]">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
                        <Icon className="h-[18px] w-[18px]" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <strong className="block text-sm">{p.label}</strong>
                        <span className="block truncate text-[11px] text-ink-500">{row.text}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <Link href="/services/work" className="flex min-h-[44px] items-center gap-2 px-1 pb-2 text-sm font-semibold text-ink-500 active:opacity-60">
            <ClipboardList size={16} aria-hidden />
            My bookings
            <ArrowRight size={14} className="text-gold" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
