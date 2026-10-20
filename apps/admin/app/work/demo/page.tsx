"use client";

import type { WorkDemoStatus } from "@peebee/shared";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog, ErrorNote, Field, inputCls, ugx, useWorkPermissions } from "../../../components/work/ui";
import { api, errorMessage } from "../../../lib/api";

export default function WorkDemoPage() {
  const { canManage } = useWorkPermissions();
  const [status, setStatus] = useState<WorkDemoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    api.workAdminDemo().then(setStatus).catch((err) => setError(errorMessage(err)));
  }, []);
  useEffect(load, [load]);

  async function install(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setMessage(null);
    try {
      setStatus(await api.workAdminInstallDemo(password));
      setMessage("Demo accounts are ready. Sign in with the phone number and the password you just chose.");
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true); setError(null); setMessage(null);
    try {
      const res = await api.workAdminRemoveDemo();
      setMessage(res.locked ? "Demo providers are offline and the accounts are locked (they have job history)." : "Demo accounts removed.");
      setConfirmRemove(false);
      load();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5">
        <h2 className="text-base font-bold text-ink">Entebbe demo accounts (sandbox)</h2>
        <p className="text-sm text-ink-500">
          A customer with {status ? ugx(status.walletUgx) : "sandbox"} of sandbox wallet money, and approved, online providers in Entebbe for laundry, cleaning
          (a company with a staff member, and an individual) and fixing. Book as the customer, accept and finish as the provider, then confirm and rate, all with sandbox money.
        </p>
        {status && !status.sandbox && <p role="alert" className="rounded-xl bg-gold/10 p-3 text-sm text-ink">The platform is live. Switch it to sandbox (Settings → Platform) before installing; demo accounts are sandbox only.</p>}
        <ErrorNote message={error} />
        {message && <p role="status" className="text-sm font-semibold text-green">{message}</p>}
        {canManage && (
          <form onSubmit={install} className="space-y-3 pt-2">
            <Field label="Password for every demo account" hint="At least 8 characters. Installing again resets the accounts and this password.">
              <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy || password.length < 8 || !status?.sandbox} className="min-h-11 rounded-full bg-gold px-5 text-sm font-bold text-ink-gold disabled:opacity-50">
                {busy ? "Working…" : status?.installed ? "Reset demo accounts" : "Install demo accounts"}
              </button>
              {status?.installed && <button type="button" onClick={() => setConfirmRemove(true)} disabled={busy} className="min-h-11 rounded-full border border-[var(--border-faint)] px-5 text-sm font-bold text-ink">Remove</button>}
            </div>
          </form>
        )}
      </section>

      {status && (
        <section className="space-y-2 rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5">
          <h2 className="text-base font-bold text-ink">Sign-in details</h2>
          <p className="text-xs text-ink-500">Sign in with the phone number (or email) and the password you set. Customers use the customer app; providers use the Work app.</p>
          <ul className="divide-y divide-[var(--border-faint)]">
            {status.accounts.map((a) => (
              <li key={a.phone} className="py-2 text-sm">
                <p className="font-bold text-ink">{a.name} <span className="font-normal text-ink-500">· {a.role}</span></p>
                <p className="text-ink-500">{a.phone} · {a.email}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {confirmRemove && (
        <ConfirmDialog title="Remove the demo accounts?" confirmLabel="Remove" danger busy={busy} onConfirm={() => void remove()} onClose={() => setConfirmRemove(false)}>
          Providers go offline. Accounts with job history are locked instead of deleted.
        </ConfirmDialog>
      )}
    </div>
  );
}
