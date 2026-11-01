"use client";

import { parseKeyLines, type AiFeatureId, type AiFeaturesOverview, type AiFeatureStatus, type AiKeyAddResult } from "@peebee/shared";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SettingsPageShell } from "../../../components/SettingsPageShell";
import { Switch } from "../../../components/ui/Switch";
import { api, errorMessage } from "../../../lib/api";
import { adminRequest, requestErrorMessage } from "../../../lib/admin-request";

type Overview = AiFeaturesOverview & { encryptionConfigured?: boolean };
type SeparateResponse = { overview: Overview; results: Partial<Record<AiFeatureId, AiKeyAddResult[]>> };

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);
const noteTone = "rounded-lg bg-[rgb(var(--surface-muted))] px-3 py-2 text-sm text-ink";

function KeyBox({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-bold text-ink">{label}</label>
      <div className="field-box rounded-xl">
        <textarea id={id} rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={"AIza…   or   Support chat key: AIza…\n(one key per line; a name is optional)"} spellCheck={false} autoComplete="off" className="w-full p-2.5 font-mono text-xs text-ink outline-none" />
      </div>
    </div>
  );
}

function ResultList({ results }: { results: AiKeyAddResult[] }) {
  if (results.length === 0) return null;
  return (
    <ul className="space-y-0.5 text-xs">
      {results.map((r, i) => (
        <li key={i} className={r.status === "added" ? "text-green-700 dark:text-green-300" : "text-red-600"}>
          {r.hint}: {r.status}{r.detail ? ` — ${r.detail}` : ""}
        </li>
      ))}
    </ul>
  );
}

export default function AiFeaturesPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Separating: the keys typed in for each feature, before anything is saved.
  const [separating, setSeparating] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Partial<Record<AiFeatureId, AiKeyAddResult[]>>>({});
  // A feature that needs a key of its own after the keys were separated.
  const [addDrafts, setAddDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const first = setTimeout(() => {
      adminRequest<Overview>("/admin/ai-features").then(setData).catch((e) => setError(requestErrorMessage(e))).finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(first);
  }, []);

  async function guarded(action: () => Promise<void>) {
    setBusy(true); setError(null); setNote(null);
    try { await action(); } catch (e) { setError(requestErrorMessage(e)); } finally { setBusy(false); }
  }

  // Features that are on need a key of their own before the keys can be separated; the ones that are off can wait.
  const needing = (data?.features ?? []).filter((f) => f.enabled && f.ownKeys === 0);
  const ready = needing.every((f) => lines(drafts[f.id] ?? "").length > 0);

  function separate() {
    return guarded(async () => {
      const keys = Object.fromEntries(Object.entries(drafts).map(([id, text]) => [id, lines(text)]).filter(([, l]) => (l as string[]).length > 0));
      try {
        const res = await adminRequest<SeparateResponse>("/admin/ai-features/separate", { method: "PUT", body: { separate: true, keys } });
        setData(res.overview); setResults(res.results); setSeparating(false); setDrafts({});
        setNote("Each AI feature now uses its own keys.");
      } catch (e) {
        // A refused key (or a feature still without one) leaves nothing changed; show what Google said about each key.
        const res = await adminRequest<Overview>("/admin/ai-features").catch(() => null);
        if (res) setData(res);
        throw e;
      }
    });
  }

  function merge() {
    if (!window.confirm("Every AI feature goes back to the shared keys. The keys you added for each feature are kept in case you separate them again.")) return;
    void guarded(async () => {
      const res = await adminRequest<SeparateResponse>("/admin/ai-features/separate", { method: "PUT", body: { separate: false } });
      setData(res.overview); setResults({});
      setNote("Every AI feature uses the shared keys again.");
    });
  }

  function toggle(f: AiFeatureStatus, enabled: boolean) {
    void guarded(async () => {
      const res = await adminRequest<{ overview: Overview }>(`/admin/ai-features/${f.id}/enabled`, { method: "PUT", body: { enabled } });
      setData(res.overview);
    });
  }

  function addOwnKeys(f: AiFeatureStatus) {
    const entries = parseKeyLines(addDrafts[f.id] ?? "");
    if (entries.length === 0) return;
    void guarded(async () => {
      const res = await api.adminAddAiKeys(entries, f.id);
      setResults((r) => ({ ...r, [f.id]: res.results }));
      if (res.results.every((r) => r.status !== "rejected")) setAddDrafts((d) => ({ ...d, [f.id]: "" }));
      setData(await adminRequest<Overview>("/admin/ai-features"));
    });
  }

  return (
    <SettingsPageShell title="AI features" loading={loading} description="The Google Gemini AI behind Peebee's features: turn each one on or off, and choose whether they all share one set of keys or each has its own.">
      {data && (
        <div className="space-y-5">
          {!data.separateAvailable && (
            <p className="rounded-lg bg-gold/15 px-3 py-2 text-sm text-ink">
              Apply migration <code>0152_ai_key_features.sql</code> to be able to give each feature its own keys. Until then every feature shares the same keys.
            </p>
          )}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {note && <p role="status" className={noteTone}>{note}</p>}

          <section className="home-card space-y-3">
            <label className="flex items-start gap-3">
              <Switch
                checked={!data.separate && !separating}
                disabled={busy || !data.separateAvailable}
                onChange={(e) => { if (e.target.checked) { setSeparating(false); if (data.separate) merge(); } else { setSeparating(true); setError(null); setNote(null); } }}
                aria-label="Use the same Gemini keys for every AI feature"
              />
              <span>
                <span className="block text-sm font-bold text-ink">Use the same Gemini keys for every AI feature</span>
                <span className="mt-0.5 block text-xs text-ink-500">
                  {data.separate
                    ? "Off: each feature uses only its own keys, so one feature running out of quota can never affect another."
                    : separating
                      ? "Add a key for each feature below, then save. Nothing changes until the keys are checked."
                      : `On: one set of keys (${data.sharedReady} of ${data.sharedKeys} ready) serves ${data.features.length} features. Manage them in `}
                  {!data.separate && !separating && <Link href="/settings/ai-keys" className="font-bold underline">Google AI keys</Link>}
                  {!data.separate && !separating && "."}
                </span>
              </span>
            </label>

            {separating && !data.separate && (
              <div className="space-y-3 border-t border-[var(--border-faint)] pt-3">
                <p className="text-sm font-bold text-ink">Give each feature its own Gemini key</p>
                <p className="text-xs text-ink-500">Each key is checked with Google, stored encrypted, and can only be used by the feature you add it to. A key cannot be used for two features.</p>
                {data.features.map((f) => f.enabled ? (
                  f.ownKeys > 0 ? (
                    <p key={f.id} className="text-xs text-ink-500"><span className="font-bold text-ink">{f.label}</span> already has {f.ownKeys} key{f.ownKeys === 1 ? "" : "s"} of its own.</p>
                  ) : (
                    <div key={f.id} className="space-y-1">
                      <KeyBox id={`sep-${f.id}`} label={`${f.label} (required)`} value={drafts[f.id] ?? ""} onChange={(v) => setDrafts((d) => ({ ...d, [f.id]: v }))} />
                      <ResultList results={results[f.id] ?? []} />
                    </div>
                  )
                ) : (
                  <div key={f.id} className="space-y-1">
                    <KeyBox id={`sep-${f.id}`} label={`${f.label} (off — optional for now)`} value={drafts[f.id] ?? ""} onChange={(v) => setDrafts((d) => ({ ...d, [f.id]: v }))} />
                    <ResultList results={results[f.id] ?? []} />
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy || !ready} onClick={() => void separate()} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-gold px-4 text-sm font-bold text-ink-gold disabled:opacity-50">
                    <KeyRound className="h-4 w-4" aria-hidden /> {busy ? "Checking the keys…" : "Check keys and separate"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => { setSeparating(false); setDrafts({}); }} className="min-h-11 rounded-full border border-[var(--border-faint)] px-4 text-sm font-bold text-ink">Cancel</button>
                </div>
                {!ready && <p className="text-xs text-ink-500">Add a key for every feature that is on to continue.</p>}
              </div>
            )}
          </section>

          <section className="space-y-3" aria-label="AI features">
            {data.features.map((f) => (
              <div key={f.id} className="home-card space-y-2">
                <label className="flex items-start gap-3">
                  <Switch checked={f.enabled} disabled={busy} onChange={(e) => toggle(f, e.target.checked)} aria-label={`${f.label} on or off`} />
                  <span>
                    <span className="block text-sm font-bold text-ink">{f.label}</span>
                    <span className="mt-0.5 block text-xs text-ink-500">{f.description}</span>
                  </span>
                </label>
                {f.keys && f.keys.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label={`Keys used by ${f.label}`}>
                    {f.keys.map((k) => (
                      <li key={k.id} className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${k.status === "ready" ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200" : k.status === "cooling" ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-200" : "bg-[rgb(var(--surface-muted))] text-ink-500"}`}>
                        {k.label}{k.status === "cooling" ? " · at its limit" : k.status === "disabled" ? " · off" : ""}
                      </li>
                    ))}
                  </ul>
                )}
                {f.pool === "shared" ? (
                  <p className="text-xs text-ink-500">Uses the shared keys ({data.sharedReady} of {data.sharedKeys} ready). <Link href="/settings/ai-keys" className="font-bold underline">Manage keys</Link></p>
                ) : (
                  <div className="space-y-2">
                    <p className={`text-xs ${f.needsKey ? "font-bold text-red-600" : "text-ink-500"}`}>
                      {f.needsKey ? "Has no key of its own, so it cannot work. Add one below." : `Has ${f.ownKeys} key${f.ownKeys === 1 ? "" : "s"} of its own (${f.ownReady} ready).`}{" "}
                      <Link href={`/settings/ai-keys?pool=${f.id}`} className="font-bold underline">Manage keys</Link>
                    </p>
                    <KeyBox id={`add-${f.id}`} label={f.needsKey ? "Gemini key for this feature" : "Add more keys for this feature"} value={addDrafts[f.id] ?? ""} onChange={(v) => setAddDrafts((d) => ({ ...d, [f.id]: v }))} />
                    <button type="button" disabled={busy || lines(addDrafts[f.id] ?? "").length === 0} onClick={() => addOwnKeys(f)} className="min-h-10 rounded-full border border-gold px-4 text-xs font-bold text-gold disabled:opacity-50">Add keys</button>
                    <ResultList results={results[f.id] ?? []} />
                  </div>
                )}
              </div>
            ))}
            <p className="text-xs text-ink-500">More AI features will appear here as Peebee adds them, each with its own switch and, when the keys are separated, its own key.</p>
          </section>
        </div>
      )}
      {!data && error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </SettingsPageShell>
  );
}
