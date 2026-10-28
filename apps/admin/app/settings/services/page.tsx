"use client";

import { MODULES, MODULE_CLUSTERS, childrenOf, resolveModuleAvailability, type ModuleDef, type ModuleFlags, type ModuleWorld } from "@peebee/shared";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SettingsPageShell, SettingsSaveBar } from "../../../components/SettingsPageShell";
import { Switch } from "../../../components/ui/Switch";
import { api, errorMessage } from "../../../lib/api";

const WORLDS: Array<{ id: ModuleWorld; label: string; blurb: string }> = [
  { id: "live", label: "Live", blurb: "What real customers, riders and businesses get. Switching a module off stops new orders; anything already in progress finishes." },
  { id: "practice", label: "Practice", blurb: "The simulated Entebbe world people use to learn the apps. A module can be on here while it is still off in Live: try it, then switch Live on." },
];

export default function ServicesPage() {
  const [saved, setSaved] = useState<ModuleFlags | null>(null);
  const [flags, setFlags] = useState<ModuleFlags | null>(null);
  const [world, setWorld] = useState<ModuleWorld>("live");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.adminGetModules()
      .then(({ modules }) => { setSaved(modules.flags); setFlags(structuredClone(modules.flags)); })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const available = useMemo(() => (flags ? resolveModuleAvailability(flags) : null), [flags]);
  const changes = useMemo(() => {
    const out: { live: Record<string, boolean>; practice: Record<string, boolean> } = { live: {}, practice: {} };
    if (!flags || !saved) return out;
    for (const def of MODULES) for (const w of ["live", "practice"] as const) if (flags[def.key]![w] !== saved[def.key]![w]) out[w][def.key] = flags[def.key]![w];
    return out;
  }, [flags, saved]);
  const dirty = Object.keys(changes.live).length + Object.keys(changes.practice).length;

  function toggle(key: string, w: ModuleWorld, on: boolean) {
    setDone(false);
    setFlags((f) => (f ? { ...f, [key]: { ...f[key]!, [w]: on } } : f));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setBusy(true); setError(null); setDone(false);
    try {
      const { modules } = await api.adminUpdateModules(changes);
      setSaved(modules.flags); setFlags(structuredClone(modules.flags)); setDone(true);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  const current = WORLDS.find((w) => w.id === world)!;

  return (
    <SettingsPageShell title="Services" description="Switch a whole service on or off, or just one thing inside it. Off disappears from every app; the code stays ready for when it is back on." loading={loading}>
      {flags && available && (
        <form onSubmit={onSubmit} className="space-y-5">
          <div role="tablist" aria-label="World" className="grid grid-cols-2 gap-1 rounded-full bg-[rgb(var(--surface-muted))] p-1 sm:inline-grid sm:min-w-[22rem]">
            {WORLDS.map((w) => (
              <button key={w.id} type="button" role="tab" aria-selected={world === w.id} onClick={() => setWorld(w.id)}
                className={`min-h-10 rounded-full px-4 text-sm font-bold transition ${world === w.id ? "bg-[rgb(var(--surface-card))] text-ink shadow-sm" : "text-ink-500"}`}>
                {w.label}
              </button>
            ))}
          </div>
          <p className="max-w-2xl text-sm text-ink-500">{current.blurb}</p>
          {world === "practice" && (
            <p className="text-xs text-ink-500">Practice as a whole, and what each module&rsquo;s practice world contains, is managed in <Link href="/practice" className="font-bold text-ink underline">Practice</Link>.</p>
          )}

          {MODULE_CLUSTERS.map((cluster) => (
            <ClusterCard key={cluster.id} cluster={cluster} world={world} flags={flags} available={available} onToggle={toggle} />
          ))}
          <SettingsSaveBar busy={busy} error={error} saved={done} />
        </form>
      )}
      {!flags && error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </SettingsPageShell>
  );
}

type Available = ReturnType<typeof resolveModuleAvailability>;
type Toggle = (key: string, world: ModuleWorld, on: boolean) => void;

/** A cluster (Ride, Buy, Learn...): its own switch in the header, and everything inside it listed below. */
function ClusterCard({ cluster, world, flags, available, onToggle }: {
  cluster: (typeof MODULE_CLUSTERS)[number]; world: ModuleWorld; flags: ModuleFlags; available: Available; onToggle: Toggle;
}) {
  const [open, setOpen] = useState(true);
  const root = MODULES.find((m) => m.key === cluster.id);
  const inside = MODULES.filter((m) => m.cluster === cluster.id && m.key !== cluster.id);
  const on = inside.filter((m) => available[m.key]![world]).length;
  const rootOn = root ? flags[root.key]![world] : true;
  const liveOnly = root?.practice.coverage === "none";
  return (
    <section className="home-card space-y-3">
      <header className="flex items-start gap-3">
        {root && !(world === "practice" && liveOnly) ? (
          <Switch aria-label={`${cluster.label} in ${world}`} checked={rootOn} onChange={(e) => onToggle(root.key, world, e.target.checked)} className="mt-1 shrink-0" />
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-ink">
            {cluster.label}{" "}
            <span className="text-xs font-normal text-ink-500">
              {world === "practice" && liveOnly ? "Not part of Practice" : !rootOn ? "Off — everything inside is hidden" : `${on} of ${inside.length} on`}
            </span>
          </h2>
          <p className="text-xs text-ink-500">{cluster.description}</p>
        </div>
        {inside.length > 0 && (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} what is inside ${cluster.label}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-500">
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        )}
      </header>
      {open && !(world === "practice" && liveOnly) && root && childrenOf(root.key).length > 0 && (
        <ul className={`space-y-1 border-t border-[var(--border-faint)] pt-2 ${rootOn ? "" : "opacity-60"}`}>
          {childrenOf(root.key).map((c) => <ModuleRow key={c.key} def={c} depth={0} world={world} flags={flags} available={available} onToggle={onToggle} />)}
        </ul>
      )}
    </section>
  );
}

function ModuleRow({ def, depth, world, flags, available, onToggle }: {
  def: ModuleDef; depth: number; world: ModuleWorld; flags: ModuleFlags;
  available: Available;
  onToggle: Toggle;
}) {
  const own = flags[def.key]![world];
  const effective = available[def.key]![world];
  const practiceOnly = world === "live" && flags[def.key]!.practice && !flags[def.key]!.live;
  const parentBlocks = own && !effective;
  return (
    <li>
      <div className="flex items-start gap-3 rounded-xl px-2 py-2" style={{ marginLeft: depth * 20 }}>
        <Switch aria-label={`${def.label} in ${world}`} checked={own} onChange={(e) => onToggle(def.key, world, e.target.checked)} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">
            {def.label}{" "}
            <span className="font-normal text-ink-500">— {parentBlocks ? "on, but paused by a module above" : own ? "on" : "off"}</span>
          </p>
          <p className="text-xs text-ink-500">{def.description}</p>
          {practiceOnly && <p className="mt-0.5 text-xs font-semibold text-ink">On in Practice only. Switch it on here to make it live.</p>}
        </div>
      </div>
      {childrenOf(def.key).length > 0 && (
        <ul className="space-y-1">
          {childrenOf(def.key).map((c) => <ModuleRow key={c.key} def={c} depth={depth + 1} world={world} flags={flags} available={available} onToggle={onToggle} />)}
        </ul>
      )}
    </li>
  );
}
