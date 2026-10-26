"use client";

import type { WithdrawalOverview } from "@peebee/shared";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Chip, Notice, TextField } from "../../../components/studio/ui";
import { useMyChannel } from "../../../components/studio/useMyChannel";
import { api, errorMessage } from "../../../lib/api";
import { ugx, uploadKycDocument } from "../../../lib/channels";

const ID_LABEL: Record<string, string> = { national_id: "National ID", passport: "Passport", driving_permit: "Driving permit" };

/** Withdrawing cash: the only place Peebee asks for identity. */
function Verify({ o, onDone }: { o: WithdrawalOverview; onDone: () => void }) {
  const rules = o.kyc.rules;
  const [fullName, setFullName] = useState(o.kyc.fullName ?? "");
  const [idType, setIdType] = useState(rules.idTypes[0] ?? "national_id");
  const [idNumber, setIdNumber] = useState("");
  const [dob, setDob] = useState("");
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(setter: (k: string) => void, key: string, file?: File) {
    if (!file) return;
    setBusy(key);
    setError(null);
    try {
      setter(await uploadKycDocument(file));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }
  const Photo = ({ id, label, done, onFile, camera }: { id: string; label: string; done: boolean; onFile: (f?: File) => void; camera?: boolean }) => (
    <label className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 text-sm font-bold ${done ? "bg-green/10 text-green" : "bg-[rgb(var(--surface-muted))] text-ink"}`}>
      <span>{label}</span>
      <span className="flex items-center gap-1.5 text-xs">{busy === id ? "Uploading…" : done ? <><CheckCircle2 className="h-4 w-4" aria-hidden /> Added</> : "Add photo"}</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" {...(camera ? { capture: "user" as const } : {})} className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
    </label>
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("submit");
    setError(null);
    try {
      await api.submitKyc({ fullName, idType, idNumber, dateOfBirth: dob, idFrontKey: front!, idBackKey: back, selfieKey: selfie });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={submit}>
      <Card title="Verify your identity" hint="We ask once, only because you are withdrawing cash. It keeps your money and everyone else's safe. Your documents are kept private.">
        {o.kyc.status === "rejected" && <Notice tone="error">Not approved: {o.kyc.reviewNotes ?? "please check your details"}. You can send them again.</Notice>}
        <TextField id="kv-name" label="Full name, as on your ID" value={fullName} onChange={setFullName} required autoComplete="name" />
        <div className="flex flex-wrap gap-2">{rules.idTypes.map((t) => <Chip key={t} active={idType === t} onClick={() => setIdType(t)}>{ID_LABEL[t] ?? t}</Chip>)}</div>
        <TextField id="kv-num" label="ID number" value={idNumber} onChange={(v) => setIdNumber(v.toUpperCase())} required autoComplete="off" />
        <TextField id="kv-dob" label="Date of birth" type="date" value={dob} onChange={setDob} required hint={`You must be at least ${rules.minAge}.`} />
        <Photo id="front" label="Front of your ID" done={!!front} onFile={(f) => void pick(setFront, "front", f)} />
        {rules.requireIdBack && <Photo id="back" label="Back of your ID" done={!!back} onFile={(f) => void pick(setBack, "back", f)} />}
        {rules.requireSelfie && <Photo id="selfie" label="A selfie" done={!!selfie} onFile={(f) => void pick(setSelfie, "selfie", f)} camera />}
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" disabled={busy !== null || !front || (rules.requireIdBack && !back) || (rules.requireSelfie && !selfie) || !fullName.trim() || !idNumber.trim() || !dob} className="w-full">{busy === "submit" ? "Sending…" : "Send for checking"}</Button>
      </Card>
    </form>
  );
}

export default function WithdrawPage() {
  const { channel, loading } = useMyChannel();
  const [o, setO] = useState<WithdrawalOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msisdn, setMsisdn] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    api.withdrawalOverview().then((r) => { setO(r); setAccountId((id) => id || r.accounts[0]?.id || ""); }).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => { if (channel) load(); }, [channel, load]);

  // A payout in flight is checked every few seconds until it settles.
  useEffect(() => {
    const pending = o?.recent.filter((r) => r.status === "pending") ?? [];
    if (pending.length === 0) return;
    timer.current = setInterval(async () => {
      for (const w of pending) await api.refreshCreatorWithdrawal(w.id).catch(() => undefined);
      load();
    }, 5000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [o, load]);

  if (loading) return <div className="p-8 text-center text-sm text-ink-500" aria-busy="true">Loading…</div>;
  if (!channel) return <Notice tone="info">Open a channel to earn money.</Notice>;
  if (error && !o) return <Notice tone="error">{error}</Notice>;
  if (!o) return <div className="p-8 text-center text-sm text-ink-500" aria-busy="true">Loading…</div>;

  const verified = o.kyc.status === "approved" || !o.kyc.required;
  const needsVerify = o.kyc.required && o.kyc.status !== "approved" && o.kyc.status !== "pending";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-ink">Withdraw</h1>
      <Card>
        <p className="text-xs text-ink-500">Available</p>
        <p className="text-3xl font-extrabold text-ink">{ugx(o.availableUgx)}</p>
        {!o.enabled && <Notice tone="info">Cash withdrawals are not open yet. Your earnings are safe and keep adding up. You can already spend them on Peebee from the <Link href="/studio/money" className="font-bold underline">Money</Link> page.</Notice>}
      </Card>
      {msg && <Notice tone={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}

      {o.enabled && o.kyc.required && (
        <Card>
          <div className="flex items-center gap-3">
            <ShieldCheck className={`h-6 w-6 ${verified ? "text-green" : "text-gold"}`} aria-hidden />
            <div><p className="text-sm font-bold text-ink">{o.kyc.status === "approved" ? "Identity verified" : o.kyc.status === "pending" ? "Checking your details" : o.kyc.status === "expired" ? "Please verify again" : "Verification needed to withdraw"}</p>
              <p className="text-xs text-ink-500">{o.kyc.status === "approved" ? `${o.kyc.fullName} · ${o.kyc.idNumberMasked}` : o.kyc.status === "pending" ? "This usually takes a short while. We will let you know." : "A one-time check before your first withdrawal."}</p></div>
          </div>
        </Card>
      )}
      {o.enabled && needsVerify && <Verify o={o} onDone={load} />}

      {o.enabled && verified && o.kyc.status !== "pending" && (
        <>
          <Card title="Where should it go?" hint="The account must be registered in your verified name.">
            {o.accounts.map((a) => <Chip key={a.id} active={accountId === a.id} onClick={() => setAccountId(a.id)}>{a.accountName} · {a.accountMasked}</Chip>)}
            <form className="space-y-3" onSubmit={async (e) => {
              e.preventDefault();
              setBusy("acct"); setMsg(null);
              try { const r = await api.addPayoutAccount({ msisdn, accountName }); setAccountId(r.account.id); setMsisdn(""); setAccountName(""); load(); } catch (err) { setMsg({ ok: false, text: errorMessage(err) }); } finally { setBusy(null); }
            }}>
              <TextField id="wd-num" label="MTN or Airtel number" type="tel" inputMode="tel" value={msisdn} onChange={setMsisdn} placeholder="07XX XXX XXX" />
              <TextField id="wd-an" label="Name on the mobile money account" value={accountName} onChange={setAccountName} />
              <Button type="submit" variant="plain" disabled={busy !== null || !msisdn || !accountName} className="w-full">Add this account</Button>
            </form>
            {o.limits.accountCooldownDays > 0 && <p className="text-xs text-ink-500">A new account can be used {o.limits.accountCooldownDays} day{o.limits.accountCooldownDays === 1 ? "" : "s"} after you add it.</p>}
          </Card>
          <Card title="How much?" hint={`${ugx(o.limits.minUgx)} to ${ugx(o.limits.maxUgx)} each time${o.limits.dailyCapUgx ? ` · ${ugx(o.limits.dailyCapUgx)} a day` : ""}`}>
            <TextField id="wd-amt" label="Amount (UGX)" type="number" inputMode="numeric" value={amount || ""} onChange={(v) => setAmount(Number(v))} />
            <div className="flex gap-2">
              <Button variant="plain" onClick={() => setAmount(Math.min(o.availableUgx, o.limits.maxUgx))} className="!min-h-10 !text-xs">Most I can</Button>
              <Button disabled={busy !== null || !accountId || amount < o.limits.minUgx || amount > o.availableUgx} onClick={async () => {
                setBusy("wd"); setMsg(null);
                try { const r = await api.withdraw({ amountUgx: amount, payoutAccountId: accountId }); setAmount(0); setMsg({ ok: true, text: `${ugx(r.amountUgx)} is on its way to your phone.` }); load(); } catch (err) { setMsg({ ok: false, text: errorMessage(err) }); } finally { setBusy(null); }
              }} className="flex-1">{busy === "wd" ? "Sending…" : "Withdraw"}</Button>
            </div>
          </Card>
        </>
      )}

      {o.recent.length > 0 && (
        <Card title="Recent withdrawals">
          <ul className="divide-y divide-[var(--border-faint)]">{o.recent.map((r) => <li key={r.id} className="flex items-center justify-between py-2.5 text-sm"><span className="text-ink">{ugx(r.amountUgx)} <span className="text-xs text-ink-500">· {new Date(r.createdAt.replace(" ", "T") + "Z").toLocaleDateString()}</span></span><span className={`text-xs font-bold capitalize ${r.status === "successful" ? "text-green" : r.status === "failed" ? "text-red-600" : "text-gold"}`}>{r.status === "failed" ? "failed · returned" : r.status}</span></li>)}</ul>
        </Card>
      )}
    </div>
  );
}
