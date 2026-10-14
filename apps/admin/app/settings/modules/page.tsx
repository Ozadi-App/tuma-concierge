"use client";

import { MODULES, allModulesOn, type ModuleKey, type ModuleSwitches } from "@peebee/shared";
import { useEffect, useState } from "react";
import { SettingsPageShell, SettingsSaveBar } from "../../../components/SettingsPageShell";
import { api, errorMessage } from "../../../lib/api";

export default function ModulesPage() {
  const [modules, setModules] = useState<ModuleSwitches | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then(({ settings }) => setModules({ ...allModulesOn(), ...(settings.modules ?? {}) }))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  function toggle(key: ModuleKey, on: boolean) {
    setSaved(false);
    setModules((m) => (m ? { ...m, [key]: on } : m));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modules) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api.adminUpdateSettings({ modules });
      setModules({ ...allModulesOn(), ...res.settings.modules });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const groups = MODULES.filter((m) => !("group" in m));

  return (
    <SettingsPageShell title="Modules" loading={loading}>
      {modules && (
        <form onSubmit={onSubmit} className="space-y-5">
          <p className="text-sm text-ink-500">
            Switch a module off and it disappears from the customer app completely — its bottom-menu item, its home tile and its pages.
            Switching a whole section off hides everything inside it. Orders already in progress finish as normal. To only pause new
            orders while keeping the screens visible, use Services instead.
          </p>
          {groups.map((group) => {
            const children = MODULES.filter((m) => "group" in m && m.group === group.key);
            const groupOn = modules[group.key];
            return (
              <section key={group.key} className="home-card space-y-2.5">
                <label className="flex items-center gap-2 text-sm font-bold text-ink">
                  <input type="checkbox" checked={groupOn} onChange={(e) => toggle(group.key, e.target.checked)} className="h-4 w-4 accent-gold" />
                  {group.label} <span className="font-normal text-ink-500">— {groupOn ? "visible" : "hidden"}</span>
                </label>
                {children.length > 0 && (
                  <ul className={`grid grid-cols-2 gap-x-3 gap-y-2 pl-6 ${groupOn ? "" : "opacity-40"}`}>
                    {children.map((child) => (
                      <li key={child.key}>
                        <label className="flex items-center gap-2 text-sm text-ink">
                          <input
                            type="checkbox"
                            disabled={!groupOn}
                            checked={groupOn && modules[child.key]}
                            onChange={(e) => toggle(child.key, e.target.checked)}
                            className="h-4 w-4 accent-gold"
                          />
                          {child.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          <SettingsSaveBar busy={busy} error={error} saved={saved} />
        </form>
      )}
      {!modules && error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </SettingsPageShell>
  );
}
