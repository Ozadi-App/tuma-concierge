"use client";

import {
  exitPracticeMode,
  isPracticeJourneyComplete,
  isPracticeMode,
  practiceStartPath,
  launchPractice,
  type PracticeRole,
} from "@peebee/shared";
import { FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { PracticeModeFrame, PracticePromptDialog } from "@peebee/shared/practice-ui";
import { api } from "../lib/api";

const ROLE_LABELS: Record<PracticeRole, string> = {
  customer: "customer", rider: "rider", restaurant: "restaurant", merchant: "merchant", gas: "fuel attendant", learner: "learner",
};

/** Set when someone leaves practice while the platform is in sandbox, so the app doesn't pull them straight back in. */
const SANDBOX_OPT_OUT_KEY = "peebee_sandbox_practice_off";
const setSandboxOptOut = (off: boolean) => { try { if (off) window.localStorage.setItem(SANDBOX_OPT_OUT_KEY, "1"); else window.localStorage.removeItem(SANDBOX_OPT_OUT_KEY); } catch { /* storage blocked: practice simply isn't remembered */ } };

/**
 * While the platform is in sandbox (the "*demo" label) the customer app opens in the simulated Entebbe practice world
 * by itself, if staff have left that on. Leaving practice is remembered, so it only happens once per device until the
 * person starts practice again from Account.
 */
export function SandboxPracticeAuto({ role }: { role: PracticeRole }) {
  useEffect(() => {
    if (role !== "customer" || isPracticeMode()) return;
    let optedOut = false;
    try { optedOut = window.localStorage.getItem(SANDBOX_OPT_OUT_KEY) === "1"; } catch { /* treat as not opted out */ }
    if (optedOut) return;
    let live = true;
    api.getSettings().then(({ settings }) => {
      if (!live || isPracticeMode()) return;
      if (settings.platformEnvironment === "sandbox" && settings.practiceModeEnabled && settings.practiceAutoInSandbox) void launchPractice(role).then((path) => window.location.replace(path));
    }).catch(() => undefined);
    return () => { live = false; };
  }, [role]);
  return null;
}

export function PracticeModeCard({ role }: { role: PracticeRole }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  useEffect(() => { api.getSettings().then(({ settings }) => setAvailable(settings.practiceModeEnabled)).catch(() => setAvailable(false)); }, []);
  useEffect(() => setActive(isPracticeMode()), []);
  if (active) {
    async function exit() { const completed = isPracticeJourneyComplete(role); exitPracticeMode(role); setSandboxOptOut(true); if (completed) await api.completePractice(role).catch(() => undefined); window.location.replace("/account"); }
    return <button type="button" onClick={exit} className="min-h-11 w-full rounded-full border border-[var(--border-faint)] px-4 text-sm font-bold text-ink">Exit practice</button>;
  }
  if (available == null) return null;
  function start() { setSandboxOptOut(false); void launchPractice(role).then((path) => window.location.assign(path)); }
  return (
    <section data-practice-role={role} className="home-card space-y-3 border-2 border-sky-300 bg-sky-50/70 dark:border-sky-800 dark:bg-sky-950/30">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-200"><FlaskConical className="h-5 w-5" strokeWidth={1.8} aria-hidden /></span><div><h2 className="text-sm font-bold text-ink">Practice Mode</h2><p className="mt-1 text-xs text-ink-500">Practise inside the real {ROLE_LABELS[role]} app with safe sample data.</p></div></div>
      <p className="rounded-xl bg-[rgb(var(--surface-muted))] p-2.5 text-xs font-semibold text-ink">The screens and controls are the same as live. No real orders, notifications, balances or payments are used.</p>
      <button type="button" onClick={start} disabled={!available} className="min-h-11 w-full rounded-full bg-sky-600 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{available ? `Open ${ROLE_LABELS[role]} practice` : "Practice is currently unavailable"}</button>
    </section>
  );
}

export function PracticeModeGuard({ role, pathname }: { role: PracticeRole; pathname: string }) {
  useEffect(() => {
    if (!isPracticeMode()) return;
    if (pathname === "/practice") { window.location.replace(practiceStartPath(role)); return; }
    api.getSettings().then(({ settings }) => { if (!settings.practiceModeEnabled) { exitPracticeMode(role); window.location.replace("/account"); } }).catch(() => undefined);
  }, [pathname, role]);
  return null;
}

/** Blue screen border + "Practice mode" tab (shared); its X leaves practice. */
export function PracticeModeBanner({ role }: { role: PracticeRole }) {
  async function exit() { const completed = isPracticeJourneyComplete(role); exitPracticeMode(role); setSandboxOptOut(true); if (completed) await api.completePractice(role).catch(() => undefined); window.location.replace("/account"); }
  return <PracticeModeFrame onExit={exit} />;
}

export function PracticeModePrompt({ role }: { role: PracticeRole }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (isPracticeMode()) return;
    api.getPracticeStatus(role).then(({ practice }) => {
      if (!practice.shouldPrompt) return;
      setOpen(true);
      void api.markPracticePrompted(role).catch(() => undefined);
    }).catch(() => undefined);
  }, [role]);
  if (!open) return null;
  function start() { void launchPractice(role).then((path) => window.location.assign(path)); }
  async function neverRemind() { setBusy(true); await api.dismissPracticeReminder(role).catch(() => undefined); setOpen(false); setBusy(false); }
  return <PracticePromptDialog
    id={`practice-prompt-${role}`}
    title="Practise before you get started?"
    body={`Learn inside the real ${ROLE_LABELS[role]} screens with sample data and simulated money. Nothing affects your live account.`}
    primaryLabel="Start practice"
    onPrimary={start}
    secondaryLabel="Maybe later"
    onSecondary={() => setOpen(false)}
    tertiaryLabel="Don't remind me again"
    onTertiary={neverRemind}
    tertiaryBusy={busy}
  />;
}
