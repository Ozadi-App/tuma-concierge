"use client";

import { hasPermission } from "@peebee/shared";
import { useCallback, useEffect, useState } from "react";
import { Card, Grid, NumberField, Notice, SelectField, Toggle, ugx, useOffersConfig } from "../../../components/offers/fields";
import { SettingsPageShell, SettingsSaveBar } from "../../../components/SettingsPageShell";
import { toast } from "../../../components/shell/Toaster";
import { adminRequest, requestErrorMessage } from "../../../lib/admin-request";
import { useAuth } from "../../../lib/auth-context";

type Overview = {
  available: boolean;
  totals: { riders: number; outstanding: number };
  top: { id: string; name: string; live: number; sandbox: number; holder: string }[];
  requests: { id: string; rider_id: string; name: string | null; created_at: string }[];
  recent: { type: string; amount: number; name: string | null; note: string | null; created_at: string }[];
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function DiscountWalletPage() {
  const { user } = useAuth();
  const can = hasPermission(user?.adminRole ?? null, "payments.manage");
  const { bundle, draft, setDraft, error, busy, saved, save, loading } = useOffersConfig("discountWallet");
  const [overview, setOverview] = useState<Overview | null>(null);

  const [version, setVersion] = useState(0);
  const refresh = useCallback(async () => { setVersion((v) => v + 1); }, []);
  useEffect(() => { adminRequest<Overview>("/admin/offers/discount-wallet").then(setOverview).catch(() => undefined); }, [version, saved]);

  async function act(path: string, done: string) {
    try {
      await adminRequest(path, { method: "POST", body: {} });
      toast(done);
      await refresh();
    } catch (err) {
      toast(requestErrorMessage(err), "error");
    }
  }

  if (!loading && !can) return <SettingsPageShell title="Rider discount wallet" loading={false}><p className="text-sm text-ink-500">You don&apos;t have permission to manage this.</p></SettingsPageShell>;
  if (loading || !draft) return <SettingsPageShell title="Rider discount wallet" loading>{null}</SettingsPageShell>;
  const set = (patch: Record<string, unknown>) => setDraft({ ...draft, ...patch });

  return (
    <SettingsPageShell title="Rider discount wallet" description="When a customer rides with an offer, the rider is not left out of pocket. What they are owed collects here, and settles Peebee's commission on their next rides before anything is collected." loading={false}>
      {bundle && !bundle.available.discountWallet && <Notice tone="warn">The discount wallet needs migration 0147 applied to the database. See MIGRATIONS_TO_APPLY.md.</Notice>}
      <form onSubmit={save} className="space-y-4">
        <Card title="How it works">
          <Toggle label="Discount wallet is on" checked={draft.enabled} onChange={(v) => set({ enabled: v })} />
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-500">Riders it applies to</p>
            <Toggle label="Boda riders" checked={draft.vehicles.boda} onChange={(v) => set({ vehicles: { ...draft.vehicles, boda: v } })} />
            <Toggle label="Car drivers" checked={draft.vehicles.car} onChange={(v) => set({ vehicles: { ...draft.vehicles, car: v } })} />
            <Toggle label="Delivery riders" checked={draft.vehicles.delivery} onChange={(v) => set({ vehicles: { ...draft.vehicles, delivery: v } })} />
          </div>
          <SelectField
            label="What the rider is compensated"
            value={draft.accrual}
            onChange={(v) => set({ accrual: v })}
            options={[
              { value: "below_minimum", label: "Only what takes the fare below the minimum fare (recommended)" },
              { value: "full_discount", label: "The whole discount, every time" },
              { value: "none", label: "Nothing — the rider carries the offer" },
            ]}
            hint="With the recommended option, a rider always earns at least the minimum fare (for example UGX 10,000 on a car ride) even when an offer takes the customer's price below it."
          />
        </Card>

        <Card title="Settling commission" hint="Each time the rider completes a ride, Peebee's commission is taken from the discount wallet first.">
          <Toggle label="Settle commission from the discount wallet first" checked={draft.offsetCommission} onChange={(v) => set({ offsetCommission: v })} />
          {draft.offsetCommission && <NumberField label="At most this share of each commission" suffix="%" value={draft.offsetMaxPercent} onChange={(v) => set({ offsetMaxPercent: v })} min={1} max={100} />}
        </Card>

        <Card title="Clearing what is left" hint="Whatever commission does not use up can be paid out. Choose how, when and how much.">
          <SelectField
            label="Pay out to"
            value={draft.payoutMethod}
            onChange={(v) => set({ payoutMethod: v })}
            options={[
              { value: "active_wallet", label: "The rider's active wallet (recommended)" },
              { value: "mobile_money", label: "Mobile money — queued for you to send, then marked paid" },
              { value: "none", label: "Nowhere — only used against commission" },
            ]}
          />
          {draft.payoutMethod !== "none" && (
            <>
              <SelectField
                label="When"
                value={draft.payoutTrigger}
                onChange={(v) => set({ payoutTrigger: v })}
                options={[
                  { value: "after_days", label: "When the balance is a number of days old (recommended)" },
                  { value: "threshold", label: "When the balance reaches an amount" },
                  { value: "daily", label: "Every day" },
                  { value: "weekly", label: "Once a week" },
                  { value: "on_request", label: "Only when the rider asks" },
                ]}
              />
              <Grid>
                {draft.payoutTrigger === "after_days" && <NumberField label="Days old" value={draft.payoutAfterDays} onChange={(v) => set({ payoutAfterDays: v })} />}
                {draft.payoutTrigger === "threshold" && <NumberField label="Balance reaches" suffix="UGX" value={draft.payoutThreshold} onChange={(v) => set({ payoutThreshold: v })} />}
                {draft.payoutTrigger === "weekly" && <SelectField label="Day of the week" value={String(draft.payoutWeekday)} onChange={(v) => set({ payoutWeekday: Number(v) })} options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))} />}
                <NumberField label="Smallest payout" suffix="UGX" value={draft.minPayout} onChange={(v) => set({ minPayout: v })} />
                <NumberField label="Pay out at once above" suffix="UGX" value={draft.maxBalance} onChange={(v) => set({ maxBalance: v })} hint="0 = no ceiling" />
              </Grid>
              <Toggle label="Riders can ask for a payout from their app" checked={draft.riderCanRequest} onChange={(v) => set({ riderCanRequest: v })} />
            </>
          )}
          <NumberField label="Unused balance expires after" suffix="days" value={draft.expiryDays} onChange={(v) => set({ expiryDays: v })} hint="0 = never expires" />
        </Card>
        <SettingsSaveBar busy={busy} error={error} saved={saved} />
      </form>

      {overview?.available && (
        <>
          <Card title="Right now" hint={`${overview.totals.riders} rider${overview.totals.riders === 1 ? "" : "s"} hold ${ugx(overview.totals.outstanding)} in total.`}>
            {overview.requests.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-ink-500">Mobile-money payouts waiting for you</p>
                {overview.requests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink">{r.name ?? r.rider_id}</span>
                    <button type="button" className="rounded-full bg-gold px-3 py-2 text-xs font-bold text-ink" onClick={() => act(`/admin/offers/discount-wallet/requests/${r.id}/paid`, "Marked as paid")}>I sent it</button>
                  </div>
                ))}
              </div>
            )}
            {overview.top.length === 0 ? <p className="text-sm text-ink-500">No rider has a balance.</p> : (
              <ul className="space-y-2 text-sm">
                {overview.top.map((r) => (
                  <li key={`${r.holder}-${r.id}`} className="flex items-center justify-between gap-3">
                    <span className="truncate text-ink">{r.name}</span>
                    <span className="flex items-center gap-3">
                      <strong className="text-ink">{ugx(r.live)}</strong>
                      {r.live > 0 && <button type="button" className="rounded-full bg-surface-muted px-3 py-1.5 text-xs font-bold text-ink" onClick={() => act(`/admin/offers/discount-wallet/${r.id}/pay-out`, "Paid to their wallet")}>Pay out now</button>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {overview.recent.length > 0 && (
            <Card title="Latest activity">
              <ul className="space-y-1.5 text-xs text-ink-500">
                {overview.recent.map((r, i) => <li key={i}>{r.name ?? "Rider"} · {r.type.replace("_", " ")} · {r.amount > 0 ? "+" : ""}{ugx(r.amount)}{r.note ? ` · ${r.note}` : ""}</li>)}
              </ul>
            </Card>
          )}
        </>
      )}
    </SettingsPageShell>
  );
}
