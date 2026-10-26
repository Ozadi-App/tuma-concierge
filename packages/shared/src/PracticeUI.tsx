"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { endServerPractice, launchServerPractice, type ServerRole } from "./practice-server.js";
import { isPracticeMode } from "./practice-runtime.js";

/** The one Peebee practice blue (matches the "Start practice" button). Practice is blue. */
export const PRACTICE_BLUE = "#0284c7";

/* Self-contained styles: apps' Tailwind builds don't scan this package, and the
 * colours here must not depend on app-specific theme variables. */
const CSS = `
.pb-practice-frame{position:fixed;z-index:2147483000;pointer-events:none;
  top:env(safe-area-inset-top,0px);right:env(safe-area-inset-right,0px);bottom:env(safe-area-inset-bottom,0px);left:env(safe-area-inset-left,0px);
  border:3px solid ${PRACTICE_BLUE};border-radius:14px}
.pb-practice-tab{position:fixed;z-index:2147483001;pointer-events:none;display:flex;align-items:center;gap:2px;
  top:env(safe-area-inset-top,0px);right:calc(env(safe-area-inset-right,0px) + 26px);
  height:24px;padding:0 3px 0 11px;background:${PRACTICE_BLUE};color:#fff;
  border-radius:0 0 12px 12px;font:700 11px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.02em;
  box-shadow:0 6px 14px -8px rgba(2,132,199,.7)}
.pb-practice-tab::before,.pb-practice-tab::after{content:"";position:absolute;top:0;width:12px;height:12px;pointer-events:none}
.pb-practice-tab::before{left:-12px;background:radial-gradient(circle at 0 100%,transparent 11.5px,${PRACTICE_BLUE} 12px)}
.pb-practice-tab::after{right:-12px;background:radial-gradient(circle at 100% 100%,transparent 11.5px,${PRACTICE_BLUE} 12px)}
.pb-practice-tab span{white-space:nowrap;padding-bottom:1px}
.pb-practice-x{pointer-events:auto;position:relative;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-left:3px;
  border:0;border-radius:999px;background:rgba(255,255,255,.18);color:#fff;cursor:pointer;padding:0;transition:background .15s ease,transform .15s ease}
.pb-practice-x::after{content:"";position:absolute;inset:-6px -6px -2px -6px}
.pb-practice-x:hover{background:rgba(255,255,255,.3)}
.pb-practice-x:active{transform:scale(.9)}
.pb-practice-x:focus-visible{outline:2px solid #fff;outline-offset:1px}
.pb-practice-x:disabled{opacity:.6}
.pb-practice-layer{position:fixed;inset:0;z-index:2147482990;display:flex;align-items:flex-end;justify-content:center;
  padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));background:rgba(8,10,14,.62);
  -webkit-backdrop-filter:blur(6px) saturate(.9);backdrop-filter:blur(6px) saturate(.9);animation:pb-practice-fade .2s ease both}
@media (min-width:640px){.pb-practice-layer{align-items:center}}
.pb-practice-dialog{--pb-bg:#ffffff;--pb-ink:#121212;--pb-muted:#5f6368;--pb-line:rgba(0,0,0,.08);--pb-soft:#e0f2fe;--pb-soft-ink:#0369a1;
  width:100%;max-width:420px;border-radius:28px;background:var(--pb-bg);color:var(--pb-ink);border:1px solid var(--pb-line);
  padding:22px 20px 16px;box-shadow:0 24px 60px -12px rgba(0,0,0,.45);font-family:inherit;animation:pb-practice-rise .26s cubic-bezier(.16,1,.3,1) both}
:root[data-theme="dark"] .pb-practice-dialog,.dark .pb-practice-dialog{--pb-bg:#1c1c1e;--pb-ink:#f5f5f5;--pb-muted:#a1a1aa;--pb-line:rgba(255,255,255,.1);--pb-soft:rgba(2,132,199,.18);--pb-soft-ink:#7dd3fc}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .pb-practice-dialog{--pb-bg:#1c1c1e;--pb-ink:#f5f5f5;--pb-muted:#a1a1aa;--pb-line:rgba(255,255,255,.1);--pb-soft:rgba(2,132,199,.18);--pb-soft-ink:#7dd3fc}}
.pb-practice-dialog:focus{outline:none}
.pb-practice-head{display:flex;gap:14px;align-items:flex-start}
.pb-practice-icon{flex:none;display:flex;width:46px;height:46px;align-items:center;justify-content:center;border-radius:16px;background:var(--pb-soft);color:var(--pb-soft-ink)}
.pb-practice-title{margin:2px 0 0;font-size:19px;line-height:1.25;font-weight:800;letter-spacing:-.01em;color:var(--pb-ink)}
.pb-practice-body{margin:6px 0 0;font-size:14px;line-height:1.5;color:var(--pb-muted)}
.pb-practice-actions{display:grid;gap:8px;margin-top:20px}
.pb-practice-primary{min-height:48px;border:0;border-radius:999px;background:${PRACTICE_BLUE};color:#fff;font-size:15px;font-weight:800;cursor:pointer;transition:transform .15s ease,filter .15s ease}
.pb-practice-primary:active{transform:scale(.98)}
.pb-practice-secondary{min-height:44px;border-radius:999px;border:1px solid var(--pb-line);background:transparent;color:var(--pb-ink);font-size:14px;font-weight:700;cursor:pointer}
.pb-practice-tertiary{min-height:36px;border:0;background:transparent;color:var(--pb-muted);font-size:12.5px;font-weight:600;cursor:pointer}
.pb-practice-tertiary:disabled{opacity:.5}
.pb-practice-primary:focus-visible,.pb-practice-secondary:focus-visible,.pb-practice-tertiary:focus-visible{outline:2px solid ${PRACTICE_BLUE};outline-offset:2px}
@keyframes pb-practice-fade{from{opacity:0}to{opacity:1}}
@keyframes pb-practice-rise{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.pb-practice-layer,.pb-practice-dialog{animation:none}.pb-practice-x,.pb-practice-primary{transition:none}}
`;

function PracticeStyles() {
  return <style href="peebee-practice-ui" precedence="default">{CSS}</style>;
}

/** True once mounted when this device is in practice mode (follows other tabs too). */
export function usePracticeModeActive(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const sync = () => setActive(isPracticeMode());
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return active;
}

/**
 * Practice-mode indicator for every app: a blue border around the visible
 * screen (inside safe areas) with a "Practice mode" tab hanging from the top
 * edge at the right, joined to the border with inner curves. Only the X takes
 * taps; it calls the app's own exit logic.
 */
export function PracticeModeFrame({ onExit, label = "Practice mode" }: { onExit: () => void | Promise<void>; label?: string }) {
  const active = usePracticeModeActive();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!active) return;
    document.documentElement.classList.add("peebee-practice");
    return () => document.documentElement.classList.remove("peebee-practice");
  }, [active]);
  if (!active) return null;
  async function exit() { setBusy(true); try { await onExit(); } finally { setBusy(false); } }
  // Portalled to <body> so no transformed/overflowing app container can trap or clip it.
  return createPortal(
    <>
      <PracticeStyles />
      <div className="pb-practice-frame" aria-hidden="true" />
      <div className="pb-practice-tab" role="status" aria-label="Practice mode is on">
        <span>{label}</span>
        <button type="button" className="pb-practice-x" onClick={exit} disabled={busy} aria-label="Exit practice mode" title="Exit practice mode">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </>,
    document.body,
  );
}

/** Clean, legible "practise first?" dialog over a dimmed, slightly blurred page. */
export function PracticePromptDialog({ id, title, body, icon, primaryLabel, onPrimary, secondaryLabel, onSecondary, tertiaryLabel, onTertiary, tertiaryBusy = false }: {
  id: string;
  title: string;
  body: ReactNode;
  icon?: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
  tertiaryLabel?: string;
  onTertiary?: () => void;
  tertiaryBusy?: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onSecondary(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSecondary]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <>
      <PracticeStyles />
      <div className="pb-practice-layer" onClick={(event) => { if (event.target === event.currentTarget) onSecondary(); }}>
        <section role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`} className="pb-practice-dialog" tabIndex={-1} autoFocus>
          <div className="pb-practice-head">
            <span className="pb-practice-icon" aria-hidden="true">
              {icon ?? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9.94 14.06 4 20M14 4l1.2 3.6L19 9l-3.8 1.4L14 14l-1.2-3.6L9 9l3.8-1.4z" /><path d="M5 3v4M3 5h4" /></svg>}
            </span>
            <div style={{ minWidth: 0 }}>
              <h2 id={`${id}-title`} className="pb-practice-title">{title}</h2>
              <p id={`${id}-body`} className="pb-practice-body">{body}</p>
            </div>
          </div>
          <div className="pb-practice-actions">
            <button type="button" className="pb-practice-primary" onClick={onPrimary}>{primaryLabel}</button>
            <button type="button" className="pb-practice-secondary" onClick={onSecondary}>{secondaryLabel}</button>
            {tertiaryLabel && onTertiary && <button type="button" className="pb-practice-tertiary" onClick={onTertiary} disabled={tertiaryBusy}>{tertiaryLabel}</button>}
          </div>
        </section>
      </div>
    </>,
    document.body,
  );
}

/**
 * The "Practise" card for apps whose practice runs on the shared world only (Partner, Pharmacy, Work, Sales, TV). It shows
 * while the admin has practice on and the person isn't already practising, signed in or not.
 */
export function ServerPracticeCard({ role, api, title = "Practice mode", body, buttonLabel = "Start practice" }: {
  role: ServerRole;
  api: { getSettings(): Promise<{ settings: { practiceModeEnabled: boolean } }> };
  title?: string;
  body: string;
  buttonLabel?: string;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.getSettings().then(({ settings }) => setAvailable(settings.practiceModeEnabled)).catch(() => setAvailable(false)); }, [api]);
  if (available == null || isPracticeMode()) return null;
  async function start() {
    setBusy(true); setError(null);
    try { window.location.assign(await launchServerPractice(role)); } catch (err) { setError(err instanceof Error ? err.message : "Practice couldn't start."); setBusy(false); }
  }
  return (
    <section data-practice-card={role} style={{ border: `2px solid ${PRACTICE_BLUE}`, borderRadius: 16, padding: 16, display: "grid", gap: 10 }}>
      <div>
        <h2 style={{ fontWeight: 700, margin: 0 }}>{title}</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.75 }}>{body}</p>
      </div>
      <button type="button" onClick={start} disabled={!available || busy} style={{ minHeight: 44, borderRadius: 999, border: 0, background: PRACTICE_BLUE, color: "#fff", fontWeight: 700, fontSize: 14, opacity: !available || busy ? 0.5 : 1 }}>
        {busy ? "Opening…" : available ? buttonLabel : "Practice is off right now"}
      </button>
      {error ? <p role="alert" style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>{error}</p> : null}
    </section>
  );
}

/** The blue practice frame for those apps. Its X puts the person's own session back and goes to `exitPath`. */
export function ServerPracticeFrame({ exitPath = "/login" }: { exitPath?: string }) {
  return <PracticeModeFrame onExit={() => { endServerPractice(); window.location.replace(exitPath); }} />;
}
