"use client";

import { FARE_SERVICES, FARE_SERVICE_LABEL, MULTIPLIER_INFO, hasPermission, type FareBreakdown, type FareService, type PricingConfig } from "@peebee/shared";
import { useEffect, useMemo, useState } from "react";
import { Card, Field, Grid, NumberField, Notice, SelectField, TextField, Toggle, WindowsEditor, ZonesEditor, ugx } from "../../components/offers/fields";
import { SettingsPageShell, SettingsSaveBar } from "../../components/SettingsPageShell";
import { adminRequest, requestErrorMessage } from "../../lib/admin-request";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

type Rates = {
  boda: { ratePerKm: number; minimumFare: number };
  parcel: { ratePerKm: number; minimumFare: number };
  shopping: { deliveryFee: number };
  car: { ratePerKm: number; minimumFare: number; comfortPremiumPercent: number; xlPremiumPercent: number };
  stopFee: number;
};
type Rounding = { enabled: boolean; step: 500 | 1000; roundUpAfter: number };
type Loaded = { pricing: PricingConfig; rates: Rates; rounding: Rounding; defaults: PricingConfig };

/** What the rule does to an amount, mirrored from the server so the examples update as you type. */
function roundWith(r: Rounding, amount: number): number {
  if (!r.enabled) return Math.round(amount);
  const lower = Math.floor(amount / r.step) * r.step;
  return amount - lower > r.roundUpAfter ? lower + r.step : lower;
}
type TimeFees = { cancellationEnabled: boolean; cancellationType: "flat" | "percent"; cancellationValue: number; waitingEnabled: boolean; waitingType: "flat" | "percent"; waitingValue: number; freeWaitingMinutes: number; waitingWarningMinutes: number };
type Preview = FareBreakdown & { premiums: { label: string; percent: number }[] };

export default function PricingPage() {
  const { user } = useAuth();
  const can = hasPermission(user?.adminRole ?? null, "payments.manage");
  const [data, setData] = useState<Loaded | null>(null);
  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);
  const [rounding, setRounding] = useState<Rounding | null>(null);
  const [timeFees, setTimeFees] = useState<TimeFees | null>(null);
  const [service, setService] = useState<FareService>("car_convenient");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([adminRequest<Loaded>("/admin/pricing"), api.getSettings()])
      .then(([p, s]) => {
        if (!alive) return;
        setData(p);
        setPricing(p.pricing);
        setRates(p.rates);
        setRounding(p.rounding);
        setTimeFees(s.settings.timeFees as TimeFees);
      })
      .catch((err) => { if (alive) setError(requestErrorMessage(err)); });
    return () => { alive = false; };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!pricing || !rates || !timeFees || !rounding) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await adminRequest<{ pricing: PricingConfig; rates: Rates; rounding: Rounding }>("/admin/pricing", { method: "PUT", body: { pricing, rates, rounding } });
      await api.adminUpdateSettings({ timeFees } as never);
      setPricing(res.pricing);
      setRates(res.rates);
      setRounding(res.rounding);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error && "status" in err ? requestErrorMessage(err) : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (data && !can) return <SettingsPageShell title="Pricing" loading={false}><p className="text-sm text-ink-500">You don&apos;t have permission to manage this.</p></SettingsPageShell>;
  if (!pricing || !rates || !timeFees || !rounding) return <SettingsPageShell title="Pricing" loading>{error ? <Notice tone="warn">{error}</Notice> : null}</SettingsPageShell>;

  const setProfile = (patch: Partial<PricingConfig["profiles"][FareService]>) => setPricing({ ...pricing, profiles: { ...pricing.profiles, [service]: { ...pricing.profiles[service], ...patch } } });
  const profile = pricing.profiles[service];
  const m = pricing.multipliers;
  const setM = <K extends keyof PricingConfig["multipliers"]>(key: K, patch: Partial<PricingConfig["multipliers"][K]>) => setPricing({ ...pricing, multipliers: { ...m, [key]: { ...(m[key] as object), ...patch } } });
  const setFees = (patch: Partial<PricingConfig["fees"]>) => setPricing({ ...pricing, fees: { ...pricing.fees, ...patch } });

  const rateFields = () => {
    if (service === "boda") return <Grid><NumberField label="Price per km" suffix="UGX" value={rates.boda.ratePerKm} onChange={(v) => setRates({ ...rates, boda: { ...rates.boda, ratePerKm: v } })} min={1} /><NumberField label="Minimum fare" suffix="UGX" value={rates.boda.minimumFare} onChange={(v) => setRates({ ...rates, boda: { ...rates.boda, minimumFare: v } })} /></Grid>;
    if (service === "parcel") return <Grid><NumberField label="Price per km" suffix="UGX" value={rates.parcel.ratePerKm} onChange={(v) => setRates({ ...rates, parcel: { ...rates.parcel, ratePerKm: v } })} min={1} /><NumberField label="Minimum fee" suffix="UGX" value={rates.parcel.minimumFare} onChange={(v) => setRates({ ...rates, parcel: { ...rates.parcel, minimumFare: v } })} /></Grid>;
    if (service === "shopping") return <NumberField label="Delivery fee" suffix="UGX" value={rates.shopping.deliveryFee} onChange={(v) => setRates({ ...rates, shopping: { deliveryFee: v } })} hint="Shopping orders are charged this flat fee on top of the items. The bands and distance settings below don't apply to them." />;
    return (
      <Grid>
        <NumberField label="Price per km" suffix="UGX" value={rates.car.ratePerKm} onChange={(v) => setRates({ ...rates, car: { ...rates.car, ratePerKm: v } })} min={1} hint="The same base for Convenient, Comfort and large cars." />
        <NumberField label="Minimum fare" suffix="UGX" value={rates.car.minimumFare} onChange={(v) => setRates({ ...rates, car: { ...rates.car, minimumFare: v } })} />
        <NumberField label="Comfort costs more by" suffix="%" value={rates.car.comfortPremiumPercent} onChange={(v) => setRates({ ...rates, car: { ...rates.car, comfortPremiumPercent: v } })} />
        <NumberField label="Large car costs more by" suffix="%" value={rates.car.xlPremiumPercent} onChange={(v) => setRates({ ...rates, car: { ...rates.car, xlPremiumPercent: v } })} />
      </Grid>
    );
  };

  return (
    <SettingsPageShell title="Pricing" description="How much a ride or delivery costs: the price per km and minimum for each service, how the rate falls on long trips, multipliers for fuel, rush hour and weather, and fees. Everything here applies to new bookings straight away; past orders keep their price." loading={false}>
      <form onSubmit={save} className="space-y-4">
        <Card title="Service" hint="Each service has its own price and rules.">
          <div className="flex flex-wrap gap-2">
            {FARE_SERVICES.map((s) => (
              <button key={s} type="button" aria-pressed={service === s} onClick={() => setService(s)} className={`rounded-full px-4 py-2 text-sm font-bold ${service === s ? "bg-gold text-ink" : "bg-surface-muted text-ink-500"}`}>{FARE_SERVICE_LABEL[s]}</button>
            ))}
          </div>
          {rateFields()}
        </Card>

        {service !== "shopping" && (
          <>
            <Card title="Distance" hint="Long trips can cost less per km. Each km is charged at the rate of the band it falls in, so a longer trip never costs less than a shorter one.">
              <div className="space-y-3">
                {(profile.bands.length ? profile.bands : [{ fromKm: 0, ratePercent: 100 }]).map((b, i) => (
                  <Grid key={i}>
                    <NumberField label={i === 0 ? "From km" : "Beyond km"} value={b.fromKm} onChange={(v) => setProfile({ bands: (profile.bands.length ? profile.bands : [b]).map((x, j) => (j === i ? { ...x, fromKm: i === 0 ? 0 : v } : x)) })} />
                    <NumberField label="Rate as a share of the price per km" suffix="%" value={b.ratePercent} onChange={(v) => setProfile({ bands: (profile.bands.length ? profile.bands : [b]).map((x, j) => (j === i ? { ...x, ratePercent: v } : x)) })} min={1} max={500} />
                  </Grid>
                ))}
                <div className="flex gap-4">
                  <button type="button" className="text-sm font-semibold text-gold" onClick={() => setProfile({ bands: [...(profile.bands.length ? profile.bands : [{ fromKm: 0, ratePercent: 100 }]), { fromKm: (profile.bands.at(-1)?.fromKm ?? 0) + 20, ratePercent: Math.max(10, (profile.bands.at(-1)?.ratePercent ?? 100) - 10) }] })}>+ Add a band</button>
                  {profile.bands.length > 1 && <button type="button" className="text-sm font-semibold text-red-600" onClick={() => setProfile({ bands: profile.bands.slice(0, -1) })}>Remove the last band</button>}
                  {profile.bands.length > 0 && <button type="button" className="text-sm font-semibold text-ink-500" onClick={() => setProfile({ bands: [] })}>One flat rate</button>}
                </div>
              </div>
              <Grid>
                <NumberField label="Base fare" suffix="UGX" value={profile.baseFare} onChange={(v) => setProfile({ baseFare: v })} hint="Charged on every trip before distance. 0 = none." />
                <NumberField label="Highest fare" suffix="UGX" value={profile.maximumFare} onChange={(v) => setProfile({ maximumFare: v })} hint="0 = no ceiling" />
                <NumberField label="Charge per minute of travel" suffix="UGX" value={profile.perMinute} onChange={(v) => setProfile({ perMinute: v })} hint="0 = distance only" />
                <NumberField label="Expected speed" suffix="km/h" value={profile.expectedSpeedKmh} onChange={(v) => setProfile({ expectedSpeedKmh: v })} min={5} max={200} hint="Used to estimate travel time." />
                <NumberField label="Road factor" value={profile.distanceFactor} onChange={(v) => setProfile({ distanceFactor: v })} min={0.5} max={3} step={0.05} hint="Straight-line distance × this = the distance charged. 1 = as measured." />
              </Grid>
            </Card>
          </>
        )}

        <Card title="Multipliers" hint="Percentages added on top of the distance charge. Switch on only the ones you want.">
          <Grid>
            <SelectField label="When several apply" value={m.combine} onChange={(v) => setPricing({ ...pricing, multipliers: { ...m, combine: v } })} options={[{ value: "add", label: "Add them together (recommended)" }, { value: "multiply", label: "Multiply one after another" }]} />
            <NumberField label="Never more than" suffix="× the fare" value={m.maxMultiplier} onChange={(v) => setPricing({ ...pricing, multipliers: { ...m, maxMultiplier: v } })} min={1} max={10} step={0.1} hint="A safety limit: 2.5 means at most 250% of the normal fare." />
          </Grid>
        </Card>

        <Card title={MULTIPLIER_INFO.fuel.label} hint={MULTIPLIER_INFO.fuel.description}>
          <Toggle label="On" checked={m.fuel.enabled} onChange={(v) => setM("fuel", { enabled: v })} />
          {m.fuel.enabled && (
            <>
              <NumberField label="For every service" suffix="%" value={m.fuel.percent} onChange={(v) => setM("fuel", { percent: v })} min={-50} max={300} hint="Raise it when fuel gets dearer, lower it when it falls." />
              <p className="text-xs font-semibold text-ink-500">Different for one service (leave empty to use the number above)</p>
              <Grid cols={3}>
                {FARE_SERVICES.map((s) => (
                  <Field key={s} label={FARE_SERVICE_LABEL[s]}>
                    <input
                      inputMode="decimal"
                      value={m.fuel.perService[s] ?? ""}
                      placeholder={String(m.fuel.percent)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d.-]/g, "");
                        const next = { ...m.fuel.perService };
                        if (raw === "" || Number.isNaN(Number(raw))) delete next[s]; else next[s] = Number(raw);
                        setM("fuel", { perService: next });
                      }}
                      className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
                    />
                  </Field>
                ))}
              </Grid>
            </>
          )}
        </Card>

        <Card title={MULTIPLIER_INFO.peak.label} hint={MULTIPLIER_INFO.peak.description}>
          <Toggle label="On" checked={m.peak.enabled} onChange={(v) => setM("peak", { enabled: v })} />
          {m.peak.enabled && (<><NumberField label="Extra" suffix="%" value={m.peak.percent} onChange={(v) => setM("peak", { percent: v })} min={-50} max={300} /><WindowsEditor value={m.peak.windows} onChange={(windows) => setM("peak", { windows })} /></>)}
        </Card>

        <Card title={MULTIPLIER_INFO.night.label} hint={MULTIPLIER_INFO.night.description}>
          <Toggle label="On" checked={m.night.enabled} onChange={(v) => setM("night", { enabled: v })} />
          {m.night.enabled && (<><NumberField label="Extra" suffix="%" value={m.night.percent} onChange={(v) => setM("night", { percent: v })} min={-50} max={300} /><WindowsEditor value={m.night.windows} onChange={(windows) => setM("night", { windows })} /></>)}
        </Card>

        <Card title={MULTIPLIER_INFO.demand.label} hint="Open requests divided by riders online. 2 means two requests for every rider.">
          <Toggle label="On" checked={m.demand.enabled} onChange={(v) => setM("demand", { enabled: v })} />
          {m.demand.enabled && (
            <div className="space-y-3">
              {m.demand.levels.map((l, i) => (
                <Grid key={i}>
                  <NumberField label="When requests per rider reach" value={l.ratio} onChange={(v) => setM("demand", { levels: m.demand.levels.map((x, j) => (j === i ? { ...x, ratio: v } : x)) })} min={1} step={0.1} />
                  <NumberField label="Extra" suffix="%" value={l.percent} onChange={(v) => setM("demand", { levels: m.demand.levels.map((x, j) => (j === i ? { ...x, percent: v } : x)) })} min={-50} max={300} />
                </Grid>
              ))}
              <div className="flex gap-4">
                <button type="button" className="text-sm font-semibold text-gold" onClick={() => setM("demand", { levels: [...m.demand.levels, { ratio: (m.demand.levels.at(-1)?.ratio ?? 1) + 1, percent: (m.demand.levels.at(-1)?.percent ?? 0) + 10 }] })}>+ Add a level</button>
                {m.demand.levels.length > 1 && <button type="button" className="text-sm font-semibold text-red-600" onClick={() => setM("demand", { levels: m.demand.levels.slice(0, -1) })}>Remove the last level</button>}
              </div>
            </div>
          )}
        </Card>

        <Card title={MULTIPLIER_INFO.traffic.label} hint={MULTIPLIER_INFO.traffic.description}>
          <Toggle label="Allowed" checked={m.traffic.enabled} onChange={(v) => setM("traffic", { enabled: v })} />
          {m.traffic.enabled && (<><NumberField label="Extra while it's on" suffix="%" value={m.traffic.percent} onChange={(v) => setM("traffic", { percent: v })} min={-50} max={300} /><Toggle label="Heavy traffic right now" hint="Flip this on and off as conditions change. Customers see the new fare on their next quote." checked={m.traffic.active} onChange={(v) => setM("traffic", { active: v })} /></>)}
        </Card>

        <Card title={MULTIPLIER_INFO.weather.label} hint={MULTIPLIER_INFO.weather.description}>
          <Toggle label="Allowed" checked={m.weather.enabled} onChange={(v) => setM("weather", { enabled: v })} />
          {m.weather.enabled && (<><NumberField label="Extra while it's on" suffix="%" value={m.weather.percent} onChange={(v) => setM("weather", { percent: v })} min={-50} max={300} /><Toggle label="Bad weather right now" checked={m.weather.active} onChange={(v) => setM("weather", { active: v })} /></>)}
        </Card>

        <Card title={MULTIPLIER_INFO.zone.label} hint={MULTIPLIER_INFO.zone.description}>
          <Toggle label="On" checked={m.zone.enabled} onChange={(v) => setM("zone", { enabled: v })} />
          {m.zone.enabled && (
            <div className="space-y-3">
              <ZonesEditor value={m.zone.zones} onChange={(zones) => setM("zone", { zones: zones.map((z, i) => (m.zone.zones[i] ? { ...m.zone.zones[i], ...z } : { ...z, percent: 10, match: "either" as const })) })} />
              {m.zone.zones.map((z, i) => (
                <Grid key={i}>
                  <NumberField label={`${z.label || `Zone ${i + 1}`}: extra`} suffix="%" value={z.percent} onChange={(v) => setM("zone", { zones: m.zone.zones.map((x, j) => (j === i ? { ...x, percent: v } : x)) })} min={-50} max={300} />
                  <SelectField label="Applies when" value={z.match} onChange={(v) => setM("zone", { zones: m.zone.zones.map((x, j) => (j === i ? { ...x, match: v } : x)) })} options={[{ value: "either", label: "Pickup or drop-off is inside" }, { value: "pickup", label: "Pickup is inside" }, { value: "dropoff", label: "Drop-off is inside" }]} />
                </Grid>
              ))}
            </div>
          )}
        </Card>

        <Card title={MULTIPLIER_INFO.holiday.label} hint={MULTIPLIER_INFO.holiday.description}>
          <Toggle label="On" checked={m.holiday.enabled} onChange={(v) => setM("holiday", { enabled: v })} />
          {m.holiday.enabled && (
            <div className="space-y-3">
              {m.holiday.periods.map((p, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-[var(--border-faint)] p-3">
                  <Grid cols={3}>
                    <TextField label="Name" value={p.label} onChange={(v) => setM("holiday", { periods: m.holiday.periods.map((x, j) => (j === i ? { ...x, label: v } : x)) })} />
                    <TextField label="From (MM-DD)" value={p.from} onChange={(v) => setM("holiday", { periods: m.holiday.periods.map((x, j) => (j === i ? { ...x, from: v } : x)) })} placeholder="12-24" />
                    <TextField label="To (MM-DD)" value={p.to} onChange={(v) => setM("holiday", { periods: m.holiday.periods.map((x, j) => (j === i ? { ...x, to: v } : x)) })} placeholder="12-26" />
                  </Grid>
                  <NumberField label="Extra" suffix="%" value={p.percent} onChange={(v) => setM("holiday", { periods: m.holiday.periods.map((x, j) => (j === i ? { ...x, percent: v } : x)) })} min={-50} max={300} />
                  <button type="button" className="text-xs font-semibold text-red-600" onClick={() => setM("holiday", { periods: m.holiday.periods.filter((_, j) => j !== i) })}>Remove</button>
                </div>
              ))}
              <button type="button" className="text-sm font-semibold text-gold" onClick={() => setM("holiday", { periods: [...m.holiday.periods, { label: "", from: "01-01", to: "01-01", percent: 10 }] })}>+ Add a holiday or event</button>
            </div>
          )}
        </Card>

        <Card title="Fees" hint="Charged on top of the fare.">
          <Toggle label="Booking fee" hint="A flat fee on every booking — all of it is Peebee's." checked={pricing.fees.bookingFee.enabled} onChange={(v) => setFees({ bookingFee: { ...pricing.fees.bookingFee, enabled: v } })} />
          {pricing.fees.bookingFee.enabled && <NumberField label="Amount" suffix="UGX" value={pricing.fees.bookingFee.amount} onChange={(v) => setFees({ bookingFee: { ...pricing.fees.bookingFee, amount: v } })} />}
          <Toggle label="Scheduled ride fee" hint="For a ride booked for later." checked={pricing.fees.scheduledFee.enabled} onChange={(v) => setFees({ scheduledFee: { ...pricing.fees.scheduledFee, enabled: v } })} />
          {pricing.fees.scheduledFee.enabled && <NumberField label="Amount" suffix="UGX" value={pricing.fees.scheduledFee.amount} onChange={(v) => setFees({ scheduledFee: { ...pricing.fees.scheduledFee, amount: v } })} />}
          <NumberField label="Each extra stop (boda rides)" suffix="UGX" value={rates.stopFee} onChange={(v) => setRates({ ...rates, stopFee: v })} />
          <NumberField label="Return trip discount" suffix="%" value={pricing.fees.returnTripDiscountPercent} onChange={(v) => setFees({ returnTripDiscountPercent: v })} max={100} hint="Off the whole fare when the customer books there and back." />
          <Toggle label="Area fees" hint="A flat fee when the trip starts or ends in an area, such as the airport or a toll road." checked={pricing.fees.zoneFees.enabled} onChange={(v) => setFees({ zoneFees: { ...pricing.fees.zoneFees, enabled: v } })} />
          {pricing.fees.zoneFees.enabled && (
            <div className="space-y-3">
              <ZonesEditor value={pricing.fees.zoneFees.zones} onChange={(zones) => setFees({ zoneFees: { ...pricing.fees.zoneFees, zones: zones.map((z, i) => (pricing.fees.zoneFees.zones[i] ? { ...pricing.fees.zoneFees.zones[i], ...z } : { ...z, amount: 5000, match: "either" as const })) } })} />
              {pricing.fees.zoneFees.zones.map((z, i) => (
                <Grid key={i}>
                  <NumberField label={`${z.label || `Area ${i + 1}`}: fee`} suffix="UGX" value={z.amount} onChange={(v) => setFees({ zoneFees: { ...pricing.fees.zoneFees, zones: pricing.fees.zoneFees.zones.map((x, j) => (j === i ? { ...x, amount: v } : x)) } })} />
                  <SelectField label="Applies when" value={z.match} onChange={(v) => setFees({ zoneFees: { ...pricing.fees.zoneFees, zones: pricing.fees.zoneFees.zones.map((x, j) => (j === i ? { ...x, match: v } : x)) } })} options={[{ value: "either", label: "Pickup or drop-off is inside" }, { value: "pickup", label: "Pickup is inside" }, { value: "dropoff", label: "Drop-off is inside" }]} />
                </Grid>
              ))}
            </div>
          )}
        </Card>

        <Card title="Waiting and cancellation" hint="Charged to the customer from their wallet. The rider keeps what a waiting or cancellation fee collects.">
          <Toggle label="Waiting fee" checked={timeFees.waitingEnabled} onChange={(v) => setTimeFees({ ...timeFees, waitingEnabled: v })} />
          {timeFees.waitingEnabled && (
            <Grid cols={3}>
              <NumberField label="Free waiting" suffix="minutes" value={timeFees.freeWaitingMinutes} onChange={(v) => setTimeFees({ ...timeFees, freeWaitingMinutes: v })} />
              <SelectField label="Then a fee of" value={timeFees.waitingType} onChange={(v) => setTimeFees({ ...timeFees, waitingType: v })} options={[{ value: "flat", label: "A fixed amount" }, { value: "percent", label: "A percent of the fare" }]} />
              <NumberField label="Amount" suffix={timeFees.waitingType === "flat" ? "UGX" : "%"} value={timeFees.waitingValue} onChange={(v) => setTimeFees({ ...timeFees, waitingValue: v })} />
            </Grid>
          )}
          <Toggle label="Cancellation fee" hint="When a customer cancels after the rider has set off." checked={timeFees.cancellationEnabled} onChange={(v) => setTimeFees({ ...timeFees, cancellationEnabled: v })} />
          {timeFees.cancellationEnabled && (
            <Grid>
              <SelectField label="Fee is" value={timeFees.cancellationType} onChange={(v) => setTimeFees({ ...timeFees, cancellationType: v })} options={[{ value: "flat", label: "A fixed amount" }, { value: "percent", label: "A percent of the fare" }]} />
              <NumberField label="Amount" suffix={timeFees.cancellationType === "flat" ? "UGX" : "%"} value={timeFees.cancellationValue} onChange={(v) => setTimeFees({ ...timeFees, cancellationValue: v })} />
            </Grid>
          )}
        </Card>

        <Card title="Rounding" hint="Every price, fee, discount and rider earning is rounded so nobody sees odd amounts like 23,600. Change the rule here; it applies to new quotes and bookings straight away.">
          <Toggle label="Round amounts" hint="Off means exact shillings." checked={rounding.enabled} onChange={(v) => setRounding({ ...rounding, enabled: v })} />
          {rounding.enabled && (
            <>
              <Grid>
                <SelectField label="Amounts are whole" value={String(rounding.step)} onChange={(v) => setRounding({ ...rounding, step: Number(v) as 500 | 1000, roundUpAfter: Math.min(rounding.roundUpAfter, Number(v) - 1) })} options={[{ value: "500", label: "UGX 500s" }, { value: "1000", label: "UGX 1,000s" }]} />
                <NumberField label="Round up when more than" suffix="UGX" value={rounding.roundUpAfter} onChange={(v) => setRounding({ ...rounding, roundUpAfter: Math.min(v, rounding.step - 1) })} max={rounding.step - 1} hint={`into each ${rounding.step.toLocaleString("en-UG")}. Lower rounds up sooner. ${rounding.step / 2} would be plain nearest.`} />
              </Grid>
              <ul className="space-y-1 text-sm text-ink-500">
                {[23_600, 64_300, 29_700, 31_100, 18_200].map((n) => <li key={n} className="flex justify-between"><span>{ugx(n)}</span><span className="font-semibold text-ink">becomes {ugx(roundWith(rounding, n))}</span></li>)}
              </ul>
              <p className="text-xs text-ink-500">Fares and fees follow this rule. Commissions, discounts, cashback and bonuses are rounded to the nearest whole step so a 12% cut doesn&apos;t quietly become 15%.</p>
            </>
          )}
        </Card>

        <Calculator pricing={pricing} rates={rates} rounding={rounding} initial={service} />
        <SettingsSaveBar busy={busy} error={error} saved={saved} />
      </form>
    </SettingsPageShell>
  );
}

function Calculator({ pricing, rates, rounding, initial }: { pricing: PricingConfig; rates: Rates; rounding: Rounding; initial: FareService }) {
  const [service, setService] = useState<FareService>(initial);
  const [km, setKm] = useState(8);
  const [when, setWhen] = useState("");
  const [stops, setStops] = useState(0);
  const [result, setResult] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const body = useMemo(() => ({ service, distanceKm: km, pricing, rates, rounding, stops, at: when ? new Date(when).toISOString() : undefined }), [service, km, pricing, rates, rounding, stops, when]);

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      adminRequest<Preview>("/admin/pricing/preview", { method: "POST", body })
        .then((r) => { if (alive) { setResult(r); setError(null); } })
        .catch((err) => { if (alive) setError(requestErrorMessage(err)); });
    }, 350);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [body]);

  return (
    <Card title="Price calculator" hint="Uses the settings above as you edit them, before you save.">
      <Grid cols={3}>
        <SelectField label="Service" value={service} onChange={setService} options={FARE_SERVICES.map((s) => ({ value: s, label: FARE_SERVICE_LABEL[s] }))} />
        <NumberField label="Trip distance" suffix="km" value={km} onChange={setKm} step={0.5} />
        <NumberField label="Extra stops" value={stops} onChange={setStops} max={5} />
      </Grid>
      <Field label="At (leave empty for now)"><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold" /></Field>
      {error && <Notice tone="warn">{error}</Notice>}
      {result && (
        <div className="space-y-2 text-sm">
          <p className="text-lg font-bold text-ink">{ugx(result.total)}</p>
          <ul className="space-y-1 text-ink-500">
            {result.lines.map((l) => <li key={l.key} className="flex justify-between gap-3"><span>{l.label}</span><span>{l.amount < 0 ? "−" : ""}{ugx(Math.abs(l.amount))}</span></li>)}
            {result.premiums.map((p) => <li key={p.label} className="flex justify-between gap-3"><span>{p.label}</span><span>+{p.percent}%</span></li>)}
          </ul>
          {result.minimumApplied && <p className="text-xs text-ink-500">The minimum fare applies.</p>}
          {result.maximumApplied && <p className="text-xs text-ink-500">The highest fare applies.</p>}
        </div>
      )}
    </Card>
  );
}
