"use client";

import { CheckCircle2, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Switch } from "./ui/Switch";
import { SettingsSaveBar } from "./SettingsPageShell";
import { errorMessage, getStoredToken } from "../lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.peebee.online";

type OptionChoice = { value: string; label: string; hint?: string; recommended: boolean; available: boolean; reason?: "not_built" | "migration_pending"; migration?: string };
type OptionValue = string | string[] | number | boolean;
export type OptionView = {
  key: string;
  module: string;
  kind: "enum" | "multi" | "int" | "bool" | "list";
  label: string;
  description: string;
  value: OptionValue;
  effective: OptionValue;
  default: OptionValue;
  min?: number;
  max?: number;
  unit?: string;
  maxItems?: number;
  itemHint?: string;
  options?: OptionChoice[];
};

const unavailableNote = (o: OptionChoice) =>
  o.reason === "migration_pending" ? `Waiting for migration ${o.migration ?? ""}`.trim() : "Not available yet";

/**
 * One panel for every option in the registry (apps/api/src/lib/option-registry.ts) of a module: the recommended choice
 * is marked, choices whose code or migration has not shipped are shown but locked, and nothing here is hard-coded.
 */
export function OptionSettingsPanel({ module, canManage }: { module: string; canManage: boolean }) {
  const [settings, setSettings] = useState<OptionView[] | null>(null);
  const [draft, setDraft] = useState<Record<string, OptionValue>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/option-settings?module=${encodeURIComponent(module)}`, { headers: { Authorization: `Bearer ${getStoredToken()}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Could not load settings");
      setSettings(data.settings as OptionView[]);
      setDraft({});
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  useEffect(() => {
    setSettings(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  const valueOf = (s: OptionView): OptionValue => (s.key in draft ? draft[s.key] : s.value);
  const dirty = useMemo(() => Object.keys(draft).length > 0, [draft]);
  const set = (key: string, value: OptionValue) => setDraft((d) => ({ ...d, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || !dirty) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/option-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getStoredToken()}` },
        body: JSON.stringify({ values: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors ? Object.values(data.errors as Record<string, string>).join(" ") : data.message || "Could not save");
      setSaved(true);
      await load();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p> : <div className="admin-skeleton h-40 rounded-[var(--radius-card)]" aria-busy="true" />;
  }

  return (
    <form onSubmit={onSubmit} className="max-w-4xl space-y-4 pb-24">
      {settings.map((s) => {
        const current = valueOf(s);
        return (
          <fieldset key={s.key} className="home-card space-y-3" disabled={!canManage}>
            <legend className="sr-only">{s.label}</legend>
            <div>
              <h3 className="text-sm font-bold text-ink">{s.label}</h3>
              <p className="mt-0.5 text-xs text-ink-500">{s.description}</p>
              {s.kind === "enum" && s.effective !== s.value && (
                <p className="mt-1 text-[11px] font-semibold text-ink-600">In force now: {s.options?.find((o) => o.value === s.effective)?.label ?? String(s.effective)} (your choice is not available yet).</p>
              )}
            </div>

            {s.kind === "bool" && (
              <Switch checked={Boolean(current)} onChange={(e) => set(s.key, e.target.checked)} aria-label={s.label} />
            )}

            {s.kind === "int" && (
              <div className="flex items-center gap-2">
                <div className="field-box w-32 rounded-xl">
                  <input
                    type="number"
                    min={s.min}
                    max={s.max}
                    value={Number(current)}
                    onChange={(e) => set(s.key, e.target.value === "" ? s.min ?? 0 : Math.round(Number(e.target.value)))}
                    aria-label={s.label}
                    className="w-full p-2.5 text-sm text-ink outline-none"
                  />
                </div>
                {s.unit && <span className="text-xs text-ink-500">{s.unit}</span>}
                <span className="text-[11px] text-ink-400">{s.min}–{s.max}</span>
              </div>
            )}

            {s.kind === "list" && (
              <div className="space-y-1">
                <div className="field-box rounded-xl">
                  <textarea
                    rows={4}
                    value={(current as string[]).join(", ")}
                    onChange={(e) => set(s.key, e.target.value.split(/[\s,]+/).filter(Boolean))}
                    aria-label={s.label}
                    className="w-full p-2.5 text-xs text-ink outline-none"
                  />
                </div>
                <p className="text-[11px] text-ink-400">Separate with commas. Use {s.itemHint}. Up to {s.maxItems}.</p>
              </div>
            )}

            {(s.kind === "enum" || s.kind === "multi") && (
              <div className="grid gap-2 sm:grid-cols-2" role={s.kind === "enum" ? "radiogroup" : "group"} aria-label={s.label}>
                {s.options!.map((o) => {
                  const selected = s.kind === "enum" ? current === o.value : (current as string[]).includes(o.value);
                  const toggle = () => {
                    if (!o.available) return;
                    if (s.kind === "enum") set(s.key, o.value);
                    else {
                      const list = current as string[];
                      set(s.key, list.includes(o.value) ? list.filter((v) => v !== o.value) : [...list, o.value]);
                    }
                  };
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role={s.kind === "enum" ? "radio" : "checkbox"}
                      aria-checked={selected}
                      aria-disabled={!o.available}
                      onClick={toggle}
                      className={`flex min-h-12 items-start gap-2 rounded-xl border p-3 text-left text-xs transition ${selected ? "border-gold bg-gold/10" : "border-ink/10"} ${o.available ? "" : "cursor-not-allowed opacity-60"}`}
                    >
                      <span className="mt-0.5 shrink-0">
                        {!o.available ? <Lock className="h-4 w-4 text-ink-400" aria-hidden /> : selected ? <CheckCircle2 className="h-4 w-4 text-gold-dark" aria-hidden /> : <span className="block h-4 w-4 rounded-full border border-ink/30" />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5 font-bold text-ink">
                          {o.label}
                          {o.recommended && <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-black uppercase text-gold-dark">Recommended</span>}
                        </span>
                        {o.hint && <span className="mt-0.5 block text-ink-500">{o.hint}</span>}
                        {!o.available && <span className="mt-0.5 block font-semibold text-ink-600">{unavailableNote(o)}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>
        );
      })}
      {canManage ? <SettingsSaveBar busy={saving} error={error} saved={saved} /> : <p className="text-xs text-ink-500">Your role can view these settings but not change them.</p>}
    </form>
  );
}
