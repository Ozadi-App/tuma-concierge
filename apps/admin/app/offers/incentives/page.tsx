"use client";

import { hasPermission, INCENTIVE_INFO, INCENTIVE_KINDS, type IncentiveKind } from "@peebee/shared";
import { useEffect, useState } from "react";
import { Card, Grid, NumberField, Notice, Pill, SelectField, Toggle, WindowsEditor, ZonesEditor, ugx, useOffersConfig } from "../../../components/offers/fields";
import { SettingsPageShell, SettingsSaveBar } from "../../../components/SettingsPageShell";
import { adminRequest } from "../../../lib/admin-request";
import { useAuth } from "../../../lib/auth-context";

type Summary = { available: boolean; spentThisMonth: number; budget: number; byKind: { kind: IncentiveKind; n: number; total: number }[]; recent: { kind: string; amount: number; note: string; name: string | null; created_at: string }[] };

export default function IncentivesPage() {
  const { user } = useAuth();
  const can = hasPermission(user?.adminRole ?? null, "payments.manage");
  const { bundle, draft, setDraft, error, busy, saved, save, loading } = useOffersConfig("incentives");
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => { adminRequest<Summary>("/admin/offers/incentives/summary").then(setSummary).catch(() => undefined); }, [saved]);

  if (!loading && !can) return <SettingsPageShell title="Rider incentives" loading={false}><p className="text-sm text-ink-500">You don&apos;t have permission to manage this.</p></SettingsPageShell>;
  if (loading || !draft) return <SettingsPageShell title="Rider incentives" loading>{null}</SettingsPageShell>;

  const kinds = draft.kinds;
  const setKind = (kind: IncentiveKind, patch: Record<string, unknown>) => setDraft({ ...draft, kinds: { ...kinds, [kind]: { ...kinds[kind], ...patch } } });
  const defaults = bundle?.defaults.incentives;

  return (
    <SettingsPageShell title="Rider incentives" description="Bonuses and boosts that reward riders and drivers. Each one can be switched on or off and tuned. The ones marked Recommended are on by default." loading={false}>
      {bundle && !bundle.available.incentives && <Notice tone="warn">Incentives need migration 0147 applied to the database. Until then nothing is paid. See MIGRATIONS_TO_APPLY.md.</Notice>}
      <form onSubmit={save} className="space-y-4">
        <Card title="Programme" hint="One budget protects Peebee: when this month's incentives reach it, no more are paid until next month.">
          <Toggle label="Rider incentives are on" checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} />
          <NumberField label="Monthly budget" suffix="UGX" value={draft.monthlyBudget} onChange={(v) => setDraft({ ...draft, monthlyBudget: v })} hint="The most Peebee pays out in incentives in a calendar month. 0 = no limit." />
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-500">Who can earn</p>
            <Toggle label="Boda riders" checked={draft.vehicles.boda} onChange={(v) => setDraft({ ...draft, vehicles: { ...draft.vehicles, boda: v } })} />
            <Toggle label="Car drivers" checked={draft.vehicles.car} onChange={(v) => setDraft({ ...draft, vehicles: { ...draft.vehicles, car: v } })} />
            <Toggle label="Delivery riders" checked={draft.vehicles.delivery} onChange={(v) => setDraft({ ...draft, vehicles: { ...draft.vehicles, delivery: v } })} />
          </div>
          {summary?.available && (
            <p className="text-sm text-ink-500">
              This month so far: <strong className="text-ink">{ugx(summary.spentThisMonth)}</strong>{summary.budget > 0 ? ` of ${ugx(summary.budget)}` : ""}.
              {summary.byKind.length > 0 && ` Most went to ${INCENTIVE_INFO[summary.byKind[0].kind]?.label ?? summary.byKind[0].kind}.`}
            </p>
          )}
        </Card>

        {INCENTIVE_KINDS.map((kind) => {
          const info = INCENTIVE_INFO[kind];
          const k = kinds[kind];
          return (
            <Card key={kind} title={info.label} hint={info.description} badge={<div className="flex gap-1.5">{info.recommended && <Pill>Recommended</Pill>}<Pill>{info.timing === "per_ride" ? "Each ride" : "Over time"}</Pill></div>}>
              <Toggle label="On" checked={k.enabled} onChange={(v) => setKind(kind, { enabled: v })} />
              {k.enabled && <Params kind={kind} k={k} set={(patch) => setKind(kind, patch)} />}
              {defaults && !k.enabled && <p className="text-xs text-ink-500">Off. Switch on to set the amounts.</p>}
            </Card>
          );
        })}
        <SettingsSaveBar busy={busy} error={error} saved={saved} />
      </form>

      {summary?.available && summary.recent.length > 0 && (
        <Card title="Recent incentive payments">
          <ul className="space-y-1.5 text-sm">
            {summary.recent.map((r, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate text-ink">{r.name ?? "Rider"} · <span className="text-ink-500">{INCENTIVE_INFO[r.kind as IncentiveKind]?.label ?? r.kind}</span></span>
                <span className="font-semibold text-ink">{ugx(r.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </SettingsPageShell>
  );
}

function RuleFields({ rule, onChange }: { rule: { type: "flat" | "percent"; value: number; maxPerRide: number }; onChange: (r: typeof rule) => void }) {
  return (
    <Grid cols={3}>
      <SelectField label="Extra is" value={rule.type} onChange={(v) => onChange({ ...rule, type: v })} options={[{ value: "flat", label: "A fixed amount" }, { value: "percent", label: "A percent of the fare" }]} />
      <NumberField label="Value" suffix={rule.type === "flat" ? "UGX" : "%"} value={rule.value} onChange={(v) => onChange({ ...rule, value: v })} />
      <NumberField label="At most per ride" suffix="UGX" value={rule.maxPerRide} onChange={(v) => onChange({ ...rule, maxPerRide: v })} hint="0 = no cap" />
    </Grid>
  );
}

function Params({ kind, k, set }: { kind: IncentiveKind; k: any; set: (patch: Record<string, unknown>) => void }) {
  switch (kind) {
    case "trip_streak":
      return (
        <>
          <Grid><NumberField label="Rides in a day" value={k.rides} onChange={(v) => set({ rides: v })} min={1} /><NumberField label="Bonus" suffix="UGX" value={k.bonus} onChange={(v) => set({ bonus: v })} /></Grid>
          <Toggle label="No cancellations that day" hint="A rider who cancelled a job that day does not earn it." checked={k.noCancelRequired} onChange={(v) => set({ noCancelRequired: v })} />
        </>
      );
    case "weekly_ladder":
      return (
        <div className="space-y-3">
          {k.tiers.map((t: { rides: number; bonus: number }, i: number) => (
            <Grid key={i}>
              <NumberField label="Rides in a week" value={t.rides} onChange={(v) => set({ tiers: k.tiers.map((x: typeof t, j: number) => (j === i ? { ...x, rides: v } : x)) })} min={1} />
              <NumberField label="Bonus" suffix="UGX" value={t.bonus} onChange={(v) => set({ tiers: k.tiers.map((x: typeof t, j: number) => (j === i ? { ...x, bonus: v } : x)) })} />
            </Grid>
          ))}
          <div className="flex gap-3">
            <button type="button" className="text-sm font-semibold text-gold" onClick={() => set({ tiers: [...k.tiers, { rides: (k.tiers.at(-1)?.rides ?? 0) + 20, bonus: (k.tiers.at(-1)?.bonus ?? 0) + 20000 }] })}>+ Add a step</button>
            {k.tiers.length > 1 && <button type="button" className="text-sm font-semibold text-red-600" onClick={() => set({ tiers: k.tiers.slice(0, -1) })}>Remove the last step</button>}
          </div>
          <p className="text-xs text-ink-500">A rider earns the highest step they reach, not every step. Paid on Monday for the week before.</p>
        </div>
      );
    case "peak_boost":
    case "night_bonus":
      return (<><RuleFields rule={k.rule} onChange={(rule) => set({ rule })} /><WindowsEditor value={k.windows} onChange={(windows) => set({ windows })} /></>);
    case "zone_boost":
      return (<><RuleFields rule={k.rule} onChange={(rule) => set({ rule })} /><ZonesEditor value={k.zones} onChange={(zones) => set({ zones })} />{k.zones.length === 0 && <Notice tone="warn">Add at least one zone or this boost never applies.</Notice>}</>);
    case "reliability_bonus":
      return (
        <Grid>
          <NumberField label="At least this many rides in the month" value={k.minRides} onChange={(v) => set({ minRides: v })} min={1} />
          <NumberField label="Rides finished" suffix="% at least" value={k.minCompletionPercent} onChange={(v) => set({ minCompletionPercent: v })} max={100} />
          <NumberField label="Cancelled" suffix="% at most" value={k.maxCancelPercent} onChange={(v) => set({ maxCancelPercent: v })} max={100} />
          <NumberField label="Bonus" suffix="UGX" value={k.bonus} onChange={(v) => set({ bonus: v })} />
        </Grid>
      );
    case "rating_bonus":
      return (
        <Grid cols={3}>
          <NumberField label="Rating at least" value={k.minRating} onChange={(v) => set({ minRating: v })} min={1} max={5} step={0.1} />
          <NumberField label="From at least this many ratings" value={k.minRatings} onChange={(v) => set({ minRatings: v })} min={1} />
          <NumberField label="Weekly bonus" suffix="UGX" value={k.bonus} onChange={(v) => set({ bonus: v })} />
        </Grid>
      );
    case "rider_referral":
      return (<Grid><NumberField label="Recruited rider's rides" value={k.afterRides} onChange={(v) => set({ afterRides: v })} min={1} /><NumberField label="Bonus" suffix="UGX" value={k.bonus} onChange={(v) => set({ bonus: v })} /></Grid>);
    case "commission_holiday":
      return (
        <Grid cols={3}>
          <NumberField label="First days" value={k.firstDays} onChange={(v) => set({ firstDays: v })} hint="0 = not by days" />
          <NumberField label="First rides" value={k.firstRides} onChange={(v) => set({ firstRides: v })} hint="0 = not by rides" />
          <NumberField label="Commission waived" suffix="%" value={k.waivePercent} onChange={(v) => set({ waivePercent: v })} max={100} />
        </Grid>
      );
    case "commission_tiers":
      return (
        <div className="space-y-3">
          {k.tiers.map((t: { ridesPerMonth: number; percent: number }, i: number) => (
            <Grid key={i}>
              <NumberField label="Rides in the month" value={t.ridesPerMonth} onChange={(v) => set({ tiers: k.tiers.map((x: typeof t, j: number) => (j === i ? { ...x, ridesPerMonth: v } : x)) })} />
              <NumberField label="Commission" suffix="%" value={t.percent} onChange={(v) => set({ tiers: k.tiers.map((x: typeof t, j: number) => (j === i ? { ...x, percent: v } : x)) })} max={100} />
            </Grid>
          ))}
          <p className="text-xs text-ink-500">Used by the commission set in Money flow: a rider with more rides pays a lower rate.</p>
        </div>
      );
    case "online_hours":
      return (<><Grid><NumberField label="Hours online in the week" value={k.hoursPerWeek} onChange={(v) => set({ hoursPerWeek: v })} min={1} max={168} /><NumberField label="Bonus" suffix="UGX" value={k.bonus} onChange={(v) => set({ bonus: v })} /></Grid><p className="text-xs font-semibold text-ink-500">Only time online inside these windows counts</p><WindowsEditor value={k.windows} onChange={(windows) => set({ windows })} /></>);
    case "long_pickup":
      return (
        <Grid cols={3}>
          <NumberField label="Free distance to pickup" suffix="km" value={k.thresholdKm} onChange={(v) => set({ thresholdKm: v })} />
          <NumberField label="Paid per extra km" suffix="UGX" value={k.perKm} onChange={(v) => set({ perKm: v })} />
          <NumberField label="At most" suffix="UGX" value={k.maxAmount} onChange={(v) => set({ maxAmount: v })} hint="0 = no cap" />
        </Grid>
      );
    case "fuel_support":
      return (<Grid><NumberField label="Rides in a week" value={k.weeklyRides} onChange={(v) => set({ weeklyRides: v })} min={1} /><NumberField label="Fuel credit" suffix="UGX" value={k.credit} onChange={(v) => set({ credit: v })} /></Grid>);
    case "milestones":
      return (
        <div className="space-y-3">
          {k.milestones.map((m: { rides: number; bonus: number }, i: number) => (
            <Grid key={i}>
              <NumberField label="At ride number" value={m.rides} onChange={(v) => set({ milestones: k.milestones.map((x: typeof m, j: number) => (j === i ? { ...x, rides: v } : x)) })} min={1} />
              <NumberField label="Reward" suffix="UGX" value={m.bonus} onChange={(v) => set({ milestones: k.milestones.map((x: typeof m, j: number) => (j === i ? { ...x, bonus: v } : x)) })} />
            </Grid>
          ))}
          <button type="button" className="text-sm font-semibold text-gold" onClick={() => set({ milestones: [...k.milestones, { rides: (k.milestones.at(-1)?.rides ?? 0) * 2 || 100, bonus: 10000 }] })}>+ Add a milestone</button>
        </div>
      );
    case "leaderboard":
      return (
        <>
          <Grid>
            <SelectField label="Period" value={k.period} onChange={(v) => set({ period: v })} options={[{ value: "week", label: "Each week" }, { value: "month", label: "Each month" }]} />
            <NumberField label="At least this many rides to qualify" value={k.minRides} onChange={(v) => set({ minRides: v })} min={1} />
          </Grid>
          {k.prizes.map((p: number, i: number) => (
            <NumberField key={i} label={`Prize for place ${i + 1}`} suffix="UGX" value={p} onChange={(v) => set({ prizes: k.prizes.map((x: number, j: number) => (j === i ? v : x)) })} />
          ))}
          <div className="flex gap-3">
            <button type="button" className="text-sm font-semibold text-gold" onClick={() => set({ prizes: [...k.prizes, Math.max(1000, Math.floor((k.prizes.at(-1) ?? 5000) / 2))] })}>+ Add a prize</button>
            {k.prizes.length > 1 && <button type="button" className="text-sm font-semibold text-red-600" onClick={() => set({ prizes: k.prizes.slice(0, -1) })}>Remove the last prize</button>}
          </div>
        </>
      );
    case "welcome_back":
      return (
        <Grid cols={3}>
          <NumberField label="Away for" suffix="days" value={k.inactiveDays} onChange={(v) => set({ inactiveDays: v })} min={1} />
          <NumberField label="Then finishes" suffix="rides" value={k.afterRides} onChange={(v) => set({ afterRides: v })} min={1} />
          <NumberField label="Bonus" suffix="UGX" value={k.bonus} onChange={(v) => set({ bonus: v })} />
        </Grid>
      );
  }
}
