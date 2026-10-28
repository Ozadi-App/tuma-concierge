"use client";

import { APP_UPDATE_APPS, APP_UPDATE_LABELS, type AppUpdateApp, type AppUpdatesSettings, type AppUpdatesUpdate } from "@peebee/shared";
import { useEffect, useState } from "react";
import { SettingsPageShell } from "../../../components/SettingsPageShell";
import { Switch } from "../../../components/ui/Switch";
import { api, errorMessage } from "../../../lib/api";

const bytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const when = (iso: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

export default function AppUpdatesPage() {
  const [data, setData] = useState<AppUpdatesSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.adminGetAppUpdates().then(setData, (err) => setError(errorMessage(err)));
  }, []);

  /** Every change here is saved straight away: choosing a live version is the action, not a form to submit. */
  async function change(update: AppUpdatesUpdate) {
    setBusy(true); setError(null);
    try { setData(await api.adminUpdateAppUpdates(update)); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <SettingsPageShell title="App updates" description="Send fixes to the phone apps without building a new APK. Phones check when the app opens; a new version takes effect the next time the app is opened." loading={!data && !error}>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {data && (
        <div className="space-y-5">
          {!data.publishConfigured && (
            <p role="status" className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3 text-sm text-ink">
              <strong>Publishing is not set up yet.</strong> Add a secret called <code>APP_UPDATES_PUBLISH_TOKEN</code> (24 or more characters) to the API and to the repository&rsquo;s secrets, so new versions can be uploaded after each release.
            </p>
          )}

          <section className="home-card space-y-4">
            <div className="flex items-start gap-3">
              <Switch aria-label="Send updates to phones" checked={data.enabled} disabled={busy} onChange={(e) => change({ enabled: e.target.checked })} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">Send updates to phones</p>
                <p className="text-xs text-ink-500">{data.enabled ? "On: phones are offered the live version below." : "Off: phones are told they are up to date and keep the version they have."}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-t border-[var(--border-faint)] pt-4">
              <Switch aria-label="New versions go live by themselves" checked={data.autoLive} disabled={busy} onChange={(e) => change({ autoLive: e.target.checked })} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">New versions go live by themselves</p>
                <p className="text-xs text-ink-500">{data.autoLive ? "On: each release is sent to phones as soon as it is published." : "Off: a new version waits here until you make it live."}</p>
              </div>
            </div>
          </section>

          {APP_UPDATE_APPS.map((app) => <AppCard key={app} app={app} data={data} busy={busy} change={change} />)}
        </div>
      )}
    </SettingsPageShell>
  );
}

function AppCard({ app, data, busy, change }: { app: AppUpdateApp; data: AppUpdatesSettings; busy: boolean; change: (u: AppUpdatesUpdate) => Promise<void> }) {
  const registry = data.apps[app];
  const live = registry.versions.find((v) => v.id === registry.live);
  return (
    <section className="home-card space-y-3">
      <header>
        <h2 className="text-base font-bold text-ink">{APP_UPDATE_LABELS[app]}</h2>
        <p className="text-xs text-ink-500">
          {live ? <>Phones get <strong className="text-ink">{live.label}</strong> ({live.id}).</> : "No version is live: phones keep the screens inside their app."}
        </p>
      </header>
      {registry.versions.length === 0 ? (
        <p className="text-sm text-ink-500">Nothing published yet. A version appears here after the next release.</p>
      ) : (
        <ul className="divide-y divide-[var(--border-faint)]">
          {registry.versions.map((v) => {
            const isLive = v.id === registry.live;
            return (
              <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">
                    {v.label} {isLive && <span className="ml-1 rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-bold text-ink">Live</span>}
                  </p>
                  <p className="text-xs text-ink-500">{when(v.publishedAt)} · {v.files} files, {bytes(v.size)} · needs app build {v.minNative}+{v.note ? ` · ${v.note}` : ""}</p>
                </div>
                {!isLive && (
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => change({ live: { [app]: v.id } })} className="min-h-9 rounded-full bg-gold px-4 text-xs font-bold text-ink-gold disabled:opacity-50">Make live</button>
                    <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Delete ${v.label}? Phones can no longer be sent it.`)) void change({ remove: [{ app, id: v.id }] }); }} className="min-h-9 rounded-full px-3 text-xs font-bold text-ink-500 disabled:opacity-50">Delete</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {live && (
        <button type="button" disabled={busy} onClick={() => change({ live: { [app]: null } })} className="min-h-9 text-xs font-bold text-ink-500 underline disabled:opacity-50">Stop sending updates for this app</button>
      )}
    </section>
  );
}
