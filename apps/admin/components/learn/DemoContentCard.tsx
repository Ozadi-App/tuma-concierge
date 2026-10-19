"use client";

import type { LearnDemoStatus } from "@peebee/shared";
import { FlaskConical } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";

/**
 * Install or remove the Peebee Learn demo content: eight educators (four institutions with several classes and
 * tutors, four individual tutors) across all five streams, free courses with placeholder videos, and two trial live
 * classes that run themselves.
 */
export function DemoContentCard({ canManage, trialCodes }: { canManage: boolean; trialCodes: [string, string] }) {
  const [status, setStatus] = useState<LearnDemoStatus | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "install" | "remove">(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.adminDemoStatus());
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function install() {
    if (!status) return;
    setBusy("install");
    setError(null);
    setMessage(null);
    try {
      for (let step = 0; step < status.steps; step += 1) {
        const res = await api.adminDemoInstall(step, password || undefined);
        setProgress(`${step + 1} of ${res.total}: ${res.label}`);
      }
      setPassword("");
      setMessage(`Demo content is installed. Trial classes open with ${trialCodes[0]} and ${trialCodes[1]}.`);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setProgress(null);
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm("Remove all demo schools, courses, trial classes and demo accounts? Learners who joined demo courses lose that progress. Real schools are not touched.")) return;
    setBusy("remove");
    setError(null);
    setMessage(null);
    try {
      const res = await api.adminDemoRemove();
      setMessage(`Removed ${res.schools} demo schools and ${res.accountsRemoved} demo accounts${res.accountsKept ? ` (${res.accountsKept} kept because they own other content)` : ""}.`);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const c = status?.counts;
  const e = status?.expected;

  return (
    <section className="space-y-4 rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <FlaskConical className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-ink">Demo content</h2>
          <p className="text-xs text-ink-500">Sample schools, tutors, courses and two practice live classes, so the platform can be tried end to end</p>
        </div>
      </div>

      {status && !status.ready && (
        <p role="alert" className="rounded-2xl bg-[rgb(var(--surface-muted))] p-4 text-sm text-ink">
          Apply these migrations to the database first, in order: <strong>{status.missing.join(", ")}</strong>.
        </p>
      )}

      {c && e && status?.ready && (
        <>
          <p className="text-sm font-semibold text-ink">{status.installed ? "Installed" : "Not installed"}</p>
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {(
              [
                ["Educators", c.educators, e.educators],
                ["Classes", c.classes, e.classes],
                ["Courses", c.courses, e.courses],
                ["Lessons", c.lessons, e.lessons],
                ["Videos", c.videos, e.videos],
                ["Trial classes", c.trials, e.trials],
              ] as const
            ).map(([label, have, want]) => (
              <div key={label} className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3">
                <dt className="text-ink-500">{label}</dt>
                <dd className="text-base font-bold text-ink">
                  {have}
                  <span className="text-xs font-normal text-ink-500"> / {want}</span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="field-box flex flex-col rounded-2xl bg-[rgb(var(--surface-muted))] p-3 sm:max-w-sm">
            <label htmlFor="demo-password" className="mb-1 text-xs font-bold text-ink-500">Demo educator password (optional)</label>
            <input
              id="demo-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={100}
              value={password}
              disabled={!canManage || busy !== null}
              onChange={(ev) => setPassword(ev.target.value)}
              className="w-full text-base font-bold text-ink outline-none"
            />
            <span className="mt-1 text-[10px] text-ink-500">
              Leave empty and the demo accounts can&apos;t be signed in to. Set one (8 or more characters) to sign in to the Educator Studio as any demo educator, for example grace.nakato@demo.peebee.invalid.
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!canManage || busy !== null}
              onClick={() => void install()}
              className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink-gold disabled:opacity-50"
            >
              {busy === "install" ? `Installing… ${progress ?? ""}` : status.installed ? "Update demo content" : "Install demo content"}
            </button>
            {c.schools > 0 && (
              <button
                type="button"
                disabled={!canManage || busy !== null}
                onClick={() => void remove()}
                className="rounded-full border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-5 py-2.5 text-sm font-bold text-ink disabled:opacity-50"
              >
                {busy === "remove" ? "Removing…" : "Remove demo content"}
              </button>
            )}
          </div>
        </>
      )}

      {message && <p role="status" className="rounded-2xl bg-green/10 p-3 text-sm font-semibold text-green">{message}</p>}
      {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
    </section>
  );
}
