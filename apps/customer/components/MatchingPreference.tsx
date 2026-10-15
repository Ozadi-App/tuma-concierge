"use client";

import { MATCHING_MODE_DESCRIPTIONS, MATCHING_MODE_LABELS, type MatchingMode } from "@peebee/shared";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useTranslate } from "../lib/i18n";

export function MatchingPreference() {
  const t = useTranslate();
  const { user, updateUser } = useAuth();
  const [enabledModes, setEnabledModes] = useState<MatchingMode[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then((res) => setEnabledModes(res.settings.enabledModes ?? []))
      .catch(() => {});
  }, []);

  if (enabledModes.length <= 1) return null; // admin's only offering one mode — nothing to choose

  async function choose(mode: MatchingMode) {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateMatchingPreference(mode);
      updateUser({ ...user, defaultMatchingMode: mode });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const current = user?.defaultMatchingMode ?? enabledModes[0];

  return (
    <section className="home-card space-y-2.5">
      <h2 className="text-sm font-semibold text-ink">{t("account_matching_heading")}</h2>
      {enabledModes.map((mode) => (
        <button
          key={mode}
          type="button"
          disabled={busy}
          onClick={() => choose(mode)}
          className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left disabled:opacity-60 ${
            current === mode ? "border-gold bg-gold/10" : "border-[var(--border-faint)]"
          }`}
        >
          <span
            className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
              current === mode ? "border-gold bg-gold" : "border-[var(--border-faint)]"
            }`}
          />
          <span>
            <span className="block text-sm font-semibold text-ink">{MATCHING_MODE_LABELS[mode]}</span>
            <span className="block text-xs text-ink-500">{MATCHING_MODE_DESCRIPTIONS[mode]}</span>
          </span>
        </button>
      ))}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </section>
  );
}
