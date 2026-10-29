"use client";

import { CREDIT_MODULES, CREDIT_MODULE_LABEL, hasPermission } from "@peebee/shared";
import { useEffect, useState } from "react";
import { Card, Field, Grid, NumberField, Notice, SelectField, TextField, Toggle, inputClass, ugx, useOffersConfig } from "../../../components/offers/fields";
import { SettingsPageShell, SettingsSaveBar } from "../../../components/SettingsPageShell";
import { toast } from "../../../components/shell/Toaster";
import { adminRequest, requestErrorMessage } from "../../../lib/admin-request";
import { useAuth } from "../../../lib/auth-context";

type Summary = { available: boolean; outstanding: number; holders: number; recent: { type: string; amount: number; name: string | null; note: string | null }[] };

export default function CreditPage() {
  const { user } = useAuth();
  const can = hasPermission(user?.adminRole ?? null, "payments.manage");
  const { bundle, draft, setDraft, error, busy, saved, save, loading } = useOffersConfig("credit");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [grant, setGrant] = useState({ customer: "", amount: 5000, note: "Credit from Peebee", partnerId: "" });
  const [reviews, setReviews] = useState<{ id: string; name: string | null; amount: number; msisdn: string; review_reason: string | null; created_at: string }[]>([]);
  const [reversal, setReversal] = useState({ topupId: "", reason: "Top-up reversed" });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    adminRequest<{ withdrawals: typeof reviews }>("/admin/wallet-withdrawals?status=review").then((r) => setReviews(r.withdrawals)).catch(() => undefined);
  }, [version]);

  async function decide(id: string, action: "approve" | "reject") {
    try {
      await adminRequest(`/admin/wallet-withdrawals/${id}/${action}`, { method: "POST", body: {} });
      toast(action === "approve" ? "Withdrawal approved and on its way" : "Withdrawal declined — the money is back in the wallet");
      setVersion((v) => v + 1);
    } catch (err) {
      toast(requestErrorMessage(err), "error");
    }
  }

  async function reverseTopup() {
    try {
      const res = await adminRequest<{ cashReversed: number; creditClawedBack: number }>("/admin/offers/credit/reverse-topup", { method: "POST", body: reversal });
      toast(`Took back ${ugx(res.cashReversed)}${res.creditClawedBack ? ` and ${ugx(res.creditClawedBack)} of bonus credit` : ""}`);
      setReversal({ ...reversal, topupId: "" });
    } catch (err) {
      toast(requestErrorMessage(err), "error");
    }
  }
  useEffect(() => { adminRequest<Summary>("/admin/offers/credit/summary").then(setSummary).catch(() => undefined); }, [saved]);

  async function giveCredit() {
    try {
      const res = await adminRequest<{ customer: { name: string } }>("/admin/offers/credit/grant", { method: "POST", body: { ...grant, partnerId: grant.partnerId.trim() || null } });
      toast(`Gave ${res.customer.name} ${ugx(grant.amount)} of credit`);
      setGrant({ ...grant, customer: "" });
      setSummary(await adminRequest<Summary>("/admin/offers/credit/summary"));
    } catch (err) {
      toast(requestErrorMessage(err), "error");
    }
  }

  if (!loading && !can) return <SettingsPageShell title="Wallet credit & bonuses" loading={false}><p className="text-sm text-ink-500">You don&apos;t have permission to manage this.</p></SettingsPageShell>;
  if (loading || !draft) return <SettingsPageShell title="Wallet credit & bonuses" loading>{null}</SettingsPageShell>;
  const set = (patch: Record<string, unknown>) => setDraft({ ...draft, ...patch });
  const setTop = (patch: Record<string, unknown>) => set({ topup: { ...draft.topup, ...patch } });
  const setBonus = (patch: Record<string, unknown>) => setTop({ bonus: { ...draft.topup.bonus, ...patch } });
  const setWd = (patch: Record<string, unknown>) => set({ withdrawal: { ...draft.withdrawal, ...patch } });

  return (
    <SettingsPageShell title="Wallet credit & bonuses" description="Bonus money a customer receives — deposit bonuses, cashback, covered fees. Credit is spent only inside Peebee and can never be withdrawn." loading={false}>
      {bundle && !bundle.available.credit && <Notice tone="warn">Wallet credit needs migration 0147 applied to the database. See MIGRATIONS_TO_APPLY.md.</Notice>}
      <form onSubmit={save} className="space-y-4">
        <Card title="Credit">
          <Toggle label="Wallet credit is on" hint="Turning it off stops new credit being given and stops existing credit being spent. Nothing is deleted." checked={draft.enabled} onChange={(v) => set({ enabled: v })} />
          <Grid>
            <SelectField label="When a customer pays from the wallet" value={draft.spendOrder} onChange={(v) => set({ spendOrder: v })} options={[{ value: "credit_first", label: "Credit is used first (recommended)" }, { value: "cash_first", label: "Cash is used first" }]} />
            <NumberField label="Credit expires after" suffix="days" value={draft.expiryDays} onChange={(v) => set({ expiryDays: v })} hint="0 = never. Applies to credit given from now on." />
          </Grid>
          <NumberField label="Credit can pay at most" suffix="% of an order" value={draft.maxSharePercent} onChange={(v) => set({ maxSharePercent: v })} min={1} max={100} />
          {summary?.available && <p className="text-sm text-ink-500">{summary.holders} customer{summary.holders === 1 ? "" : "s"} hold <strong className="text-ink">{ugx(summary.outstanding)}</strong> of credit.</p>}
        </Card>

        <Card title="Where credit can be spent" hint="Pick the services that accept credit. Everything else is paid with cash only.">
          {CREDIT_MODULES.map((m) => (
            <Toggle key={m} label={CREDIT_MODULE_LABEL[m]} checked={draft.spendableModules[m]} onChange={(v) => set({ spendableModules: { ...draft.spendableModules, [m]: v } })} />
          ))}
        </Card>

        <Card title="Partner deals" hint="Merchants, restaurants and providers where credit is accepted even if their service is off above — for example a deal where Peebee funds a discount there.">
          <Field label="Partner ids, one per line">
            <textarea value={draft.partnerIds.join("\n")} onChange={(e) => set({ partnerIds: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} rows={4} className={inputClass} placeholder="Store or restaurant id" />
          </Field>
          <Toggle label="Credit given for a partner only works at that partner" checked={draft.partnerCreditLocked} onChange={(v) => set({ partnerCreditLocked: v })} />
        </Card>

        <Card title="Top-ups" hint="What happens when a customer loads money. Mobile-money and tax charges can leave the wallet with less than was paid.">
          <SelectField
            label="Fees on a top-up"
            value={draft.topup.feeMode}
            onChange={(v) => setTop({ feeMode: v })}
            options={[
              { value: "make_whole", label: "Peebee covers them — the wallet shows the full amount (recommended)" },
              { value: "customer_pays", label: "The customer pays them — the wallet gets the amount minus fees" },
            ]}
            hint="The part Peebee covers is added as credit, so it can't be withdrawn."
          />
          {draft.topup.feeMode === "make_whole" && (
            <>
              <Toggle label="Also cover the tax" checked={draft.topup.makeWholeIncludesTax} onChange={(v) => setTop({ makeWholeIncludesTax: v })} />
              <Grid cols={3}>
                <NumberField label="Only for top-ups of at least" suffix="UGX" value={draft.topup.makeWholeMinTopup} onChange={(v) => setTop({ makeWholeMinTopup: v })} />
                <NumberField label="At most per customer a month" suffix="UGX" value={draft.topup.makeWholeMonthlyCapPerCustomer} onChange={(v) => setTop({ makeWholeMonthlyCapPerCustomer: v })} hint="0 = no cap" />
                <NumberField label="At most across everyone a month" suffix="UGX" value={draft.topup.makeWholeMonthlyBudget} onChange={(v) => setTop({ makeWholeMonthlyBudget: v })} hint="0 = no cap" />
              </Grid>
            </>
          )}
        </Card>

        <Card title="Deposit bonus" hint="A reward for topping up. It is credit: spendable on Peebee, never withdrawable.">
          <Toggle label="Give a bonus on deposits" checked={draft.topup.bonus.enabled} onChange={(v) => setBonus({ enabled: v })} />
          {draft.topup.bonus.enabled && (
            <>
              <Grid cols={3}>
                <SelectField label="Bonus is" value={draft.topup.bonus.type} onChange={(v) => setBonus({ type: v })} options={[{ value: "percent", label: "A percent of the deposit" }, { value: "flat", label: "A fixed amount" }]} />
                <NumberField label="Value" suffix={draft.topup.bonus.type === "percent" ? "%" : "UGX"} value={draft.topup.bonus.value} onChange={(v) => setBonus({ value: v })} />
                <NumberField label="Smallest deposit that earns it" suffix="UGX" value={draft.topup.bonus.minDeposit} onChange={(v) => setBonus({ minDeposit: v })} />
              </Grid>
              <Grid cols={3}>
                <NumberField label="Most per deposit" suffix="UGX" value={draft.topup.bonus.maxBonusPerDeposit} onChange={(v) => setBonus({ maxBonusPerDeposit: v })} hint="0 = no cap" />
                <NumberField label="Most per customer a month" suffix="UGX" value={draft.topup.bonus.maxBonusPerMonth} onChange={(v) => setBonus({ maxBonusPerMonth: v })} hint="0 = no cap" />
                <NumberField label="Bonus deposits a day" value={draft.topup.bonus.maxBonusDepositsPerDay} onChange={(v) => setBonus({ maxBonusDepositsPerDay: v })} hint="0 = no limit" />
              </Grid>
              <Toggle label="Only the first deposit" checked={draft.topup.bonus.firstDepositOnly} onChange={(v) => setBonus({ firstDepositOnly: v })} />
              <Toggle label="Only for verified customers" checked={draft.topup.bonus.requireVerified} onChange={(v) => setBonus({ requireVerified: v })} />
            </>
          )}
        </Card>

        <Card title="Withdrawals and abuse protection" hint="The customer wallet is closed-loop today: customers top up and spend, they don't cash out. Turn cash-out on if you want it, with these protections.">
          <Toggle label="Customers can withdraw their cash balance" checked={draft.withdrawal.enabled} onChange={(v) => setWd({ enabled: v })} />
          <Toggle label="One bonus per mobile-money number" hint="The same number can't earn a deposit bonus on several accounts." checked={draft.withdrawal.oneBonusPerPhone} onChange={(v) => setWd({ oneBonusPerPhone: v })} />
          <Toggle label="Take the bonus back if a deposit is reversed" checked={draft.withdrawal.clawbackOnReversal} onChange={(v) => setWd({ clawbackOnReversal: v })} />
          {draft.withdrawal.enabled && (
            <>
              <Grid cols={3}>
                <NumberField label="Deposits are locked for" suffix="days" value={draft.withdrawal.lockDays} onChange={(v) => setWd({ lockDays: v })} />
                <NumberField label="One request takes at most" suffix="% of cash" value={draft.withdrawal.maxPercentPerRequest} onChange={(v) => setWd({ maxPercentPerRequest: v })} min={1} max={100} />
                <NumberField label="Smallest withdrawal" suffix="UGX" value={draft.withdrawal.minAmount} onChange={(v) => setWd({ minAmount: v })} />
                <NumberField label="Daily limit" suffix="UGX" value={draft.withdrawal.dailyLimit} onChange={(v) => setWd({ dailyLimit: v })} hint="0 = no limit" />
                <NumberField label="Always keep" suffix="UGX" value={draft.withdrawal.keepMinimum} onChange={(v) => setWd({ keepMinimum: v })} />
                <NumberField label="Hold for review if a bonus came in within" suffix="days" value={draft.withdrawal.reviewIfWithinDays} onChange={(v) => setWd({ reviewIfWithinDays: v })} hint="0 = no review" />
              </Grid>
              <Notice>Credit is never withdrawable. Only deposited cash can be taken out, and not during the lock.</Notice>
            </>
          )}
        </Card>
        <SettingsSaveBar busy={busy} error={error} saved={saved} />
      </form>

      <Card title="Give a customer credit" hint="For goodwill, compensation or a campaign.">
        <Grid>
          <TextField label="Customer's phone or email" value={grant.customer} onChange={(v) => setGrant({ ...grant, customer: v })} />
          <NumberField label="Amount" suffix="UGX" value={grant.amount} onChange={(v) => setGrant({ ...grant, amount: v })} min={100} />
        </Grid>
        <Grid>
          <TextField label="Note the customer sees" value={grant.note} onChange={(v) => setGrant({ ...grant, note: v })} maxLength={140} />
          <TextField label="Only usable at this partner (optional)" value={grant.partnerId} onChange={(v) => setGrant({ ...grant, partnerId: v })} />
        </Grid>
        <button type="button" onClick={giveCredit} disabled={!grant.customer.trim()} className="admin-btn-gold min-h-11 px-6 text-sm font-bold">Give credit</button>
      </Card>

      {reviews.length > 0 && (
        <Card title="Withdrawals waiting for you" hint="These came soon after a bonus. The money has already left the customer's wallet; approve to send it, or decline to give it back.">
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="space-y-1.5 text-sm">
                <p className="text-ink"><strong>{r.name ?? "Customer"}</strong> · {ugx(r.amount)} to {r.msisdn}</p>
                {r.review_reason && <p className="text-xs text-ink-500">{r.review_reason}</p>}
                <div className="flex gap-2">
                  <button type="button" className="rounded-full bg-gold px-4 py-2 text-xs font-bold text-ink" onClick={() => decide(r.id, "approve")}>Approve</button>
                  <button type="button" className="rounded-full bg-surface-muted px-4 py-2 text-xs font-bold text-ink" onClick={() => decide(r.id, "reject")}>Decline</button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Reverse a top-up" hint="For a payment that was charged back, paid twice or turned out to be fraud. The cash comes back out of the wallet (which can go below zero), and — if you chose so above — so does the bonus it earned.">
        <Grid>
          <TextField label="Top-up id" value={reversal.topupId} onChange={(v) => setReversal({ ...reversal, topupId: v })} />
          <TextField label="Reason" value={reversal.reason} onChange={(v) => setReversal({ ...reversal, reason: v })} maxLength={140} />
        </Grid>
        <button type="button" disabled={reversal.topupId.trim().length < 3} onClick={() => { if (window.confirm("Reverse this top-up? This can't be undone.")) void reverseTopup(); }} className="rounded-full bg-surface-muted px-5 py-2.5 text-sm font-bold text-ink disabled:opacity-50">Reverse top-up</button>
      </Card>

      {summary?.available && summary.recent.length > 0 && (
        <Card title="Latest credit activity">
          <ul className="space-y-1.5 text-xs text-ink-500">
            {summary.recent.map((r, i) => <li key={i}>{r.name ?? "Customer"} · {r.type.replace("_", " ")} · {r.amount > 0 ? "+" : ""}{ugx(r.amount)}{r.note ? ` · ${r.note}` : ""}</li>)}
          </ul>
        </Card>
      )}
    </SettingsPageShell>
  );
}
