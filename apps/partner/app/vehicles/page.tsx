"use client";

import { Select } from "@peebee/shared/select";

import { CAR_MODEL_CATALOG, getCarBodyType, getCarDefaults, isVipRate, type CarCategory, type OwnerDeals } from "@peebee/shared";
import { Camera, Crown, Fuel, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApplyCard } from "../../components/ApplyCard";
import { AuthImage } from "../../components/AuthImage";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { compressImage } from "../../lib/image-compress";
import { TermsEditor } from "../../components/TermsEditor";

const field = "min-h-12 w-full rounded-xl border border-[var(--border-faint)] px-3";

type Picked = { id: string; file: File; preview: string };

/** Order the vehicle types: ordinary taxis, then Luxury, Ambulance, and cargo last. */
const groupRank = (c: { kind: string; service_group?: string }) => (c.kind === "cargo" ? 3 : c.service_group === "luxury" ? 1 : c.service_group === "ambulance" ? 2 : 0);

export default function VehiclesPage() {
  const { me, mode, refreshMe, user } = useAuth();
  const [categories, setCategories] = useState<CarCategory[]>([]);
  const [limits, setLimits] = useState({ max: 8, minRequired: 0 });
  const [tiersEnabled, setTiersEnabled] = useState(false);
  const [dealLimits, setDealLimits] = useState<NonNullable<Awaited<ReturnType<typeof api.getCarConfig>>["deals"]> | null>(null);
  const [dealVehicles, setDealVehicles] = useState<OwnerDeals["vehicles"]>([]);
  const [categoryId, setCategoryId] = useState("");
  const specialSelected = (() => { const c = categories.find((x) => x.id === categoryId); return c && c.service_group && c.service_group !== "standard" ? c : undefined; })();
  const [plate, setPlate] = useState("");
  const [make, setMake] = useState("");
  const [customMake, setCustomMake] = useState("");
  const [model, setModel] = useState("");
  const [modelCatalogId, setModelCatalogId] = useState("");
  const [bodyTypeFilter, setBodyTypeFilter] = useState("All");
  const [systemHelperInfo, setSystemHelperInfo] = useState<{
    model: string;
    bodyType: string;
    seatCapacity: string;
    pseudoPlate: string;
    townDailyUgx: number;
    upcountryDailyUgx: number;
    isVip: boolean;
  } | null>(null);
  const [year, setYear] = useState("");
  const [colour, setColour] = useState("");
  const [lastServiceDate, setLastServiceDate] = useState("");
  const [serviceClass, setServiceClass] = useState<"convenient" | "comfort">("convenient");
  const [acceptsConvenient, setAcceptsConvenient] = useState(false);
  const [conditionGrade, setConditionGrade] = useState<"excellent" | "good" | "fair">("good");
  const [seatCapacity, setSeatCapacity] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const addInput = useRef<HTMLInputElement>(null);

  function applyCarProfile(profile: (typeof CAR_MODEL_CATALOG)[number]) {
    const defaults = getCarDefaults(profile);
    setModelCatalogId(defaults.modelCatalogId);
    setModel(defaults.model);
    setSeatCapacity(defaults.seatCapacity);
    if (!year || year === "2018") setYear(defaults.year);
    setServiceClass(defaults.serviceClass);
    setConditionGrade(defaults.conditionGrade);
    setFeatures((prev) => Array.from(new Set([...prev, ...defaults.features])));
    if (!plate) setPlate(defaults.pseudoPlate);

    if (defaults.isVip) {
      const luxuryCat = categories.find((c) => c.service_group === "luxury" || /luxury/i.test(c.name));
      if (luxuryCat) setCategoryId(luxuryCat.id);
    } else {
      const matchedCat = categories.find(
        (c) => c.kind === "passenger" && c.service_group !== "luxury" && c.seats && c.seats >= profile.seats
      ) || categories.find((c) => c.kind === "passenger" && c.service_group !== "luxury");
      if (matchedCat && !categoryId) setCategoryId(matchedCat.id);
    }

    setSystemHelperInfo({
      model: defaults.model,
      bodyType: defaults.bodyType,
      seatCapacity: defaults.seatCapacity,
      pseudoPlate: defaults.pseudoPlate,
      townDailyUgx: defaults.townDailyUgx,
      upcountryDailyUgx: defaults.upcountryDailyUgx,
      isVip: defaults.isVip,
    });
  }

  function handleMakeChange(newMake: string) {
    setMake(newMake);
    setBodyTypeFilter("All");
    setModel("");
    setModelCatalogId("");
    setSeatCapacity("");
    setSystemHelperInfo(null);
  }

  function handleBodyTypeChange(type: string) {
    setBodyTypeFilter(type);
    const available = CAR_MODEL_CATALOG.filter(
      (m) => m.make === make && (type === "All" || getCarBodyType(m) === type)
    );
    if (available.length === 1) {
      applyCarProfile(available[0]);
    } else if (modelCatalogId && !available.some((m) => m.id === modelCatalogId)) {
      setModel("");
      setModelCatalogId("");
      setSystemHelperInfo(null);
    }
  }

  function handleModelSelect(catalogId: string) {
    const profile = CAR_MODEL_CATALOG.find((m) => m.id === catalogId);
    if (profile) {
      setBodyTypeFilter(getCarBodyType(profile));
      applyCarProfile(profile);
    } else {
      setModelCatalogId("");
      setModel("");
      setSystemHelperInfo(null);
    }
  }

  useEffect(() => {
    api.getCarConfig().then((c) => {
      setCategories(c.categories);
      setTiersEnabled(Boolean(c.serviceTiers));
      if (c.vehiclePhotos) setLimits(c.vehiclePhotos);
      setDealLimits(c.deals ?? null);
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!dealLimits) return;
    api.dealsOwner().then((d) => setDealVehicles(d.vehicles)).catch(() => undefined);
  }, [dealLimits, me?.vehicles.length]);
  useEffect(() => () => picked.forEach((p) => URL.revokeObjectURL(p.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Owners and drivers both bring cars; each profile works on its own.
  const canAdd = ["approved", "pending"].includes(me?.ownerStatus ?? "") || ["approved", "pending"].includes(me?.driverStatus ?? "");
  if (!me || !canAdd) return <div className="px-4 py-5"><ApplyCard mode={mode} /></div>;
  const approvedDriver = me.driverStatus === "approved";

  function pick(files: FileList | null, existing = 0) {
    if (!files) return;
    const room = Math.max(0, limits.max - existing - picked.length);
    const next = Array.from(files).slice(0, room).map((file) => ({ id: `${file.name}-${file.size}-${Math.random()}`, file, preview: URL.createObjectURL(file) }));
    if (files.length > room) setError(`A vehicle can have up to ${limits.max} photos.`);
    else setError("");
    setPicked((cur) => [...cur, ...next]);
  }
  function drop(id: string) {
    setPicked((cur) => {
      const gone = cur.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return cur.filter((p) => p.id !== id);
    });
  }

  /** Uploads the chosen photos one by one; returns how many went through. */
  async function uploadAll(vehicleId: string, files: Picked[]): Promise<number> {
    let done = 0;
    for (const p of files) {
      setProgress(`Uploading photo ${done + 1} of ${files.length}…`);
      try {
        await api.carUploadVehiclePhoto(vehicleId, await compressImage(p.file));
        done += 1;
      } catch (err) {
        setError(errorMessage(err));
      }
    }
    return done;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { id } = await api.carAddVehicle({ categoryId, plate, make: (make === "Other" ? customMake : make) || undefined, model: model || undefined, modelCatalogId: modelCatalogId || undefined, year: Number(year) || undefined, colour: colour || undefined, lastServiceDate, serviceClass: specialSelected ? "convenient" : serviceClass, acceptsConvenient: specialSelected ? false : acceptsConvenient, conditionGrade, seatCapacity: Number(seatCapacity) || undefined, features });
      const sent = await uploadAll(id, picked);
      if (sent < picked.length) setError(`The vehicle was submitted, but only ${sent} of ${picked.length} photos uploaded. You can add the rest from its card below.`);
      picked.forEach((p) => URL.revokeObjectURL(p.preview));
      setPicked([]);
      setPlate("");
      setMake("");
      setModel("");
      setCustomMake(""); setBodyTypeFilter("All"); setSystemHelperInfo(null);
      setYear(""); setColour(""); setLastServiceDate("");
      setModelCatalogId(""); setServiceClass("convenient"); setAcceptsConvenient(false); setConditionGrade("good"); setSeatCapacity(""); setFeatures([]);
      await refreshMe();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function addToExisting(vehicleId: string, files: FileList | null, have: number) {
    if (!files || files.length === 0) return;
    const room = Math.max(0, limits.max - have);
    const chosen = Array.from(files).slice(0, room).map((file) => ({ id: file.name, file, preview: "" }));
    setBusy(true);
    setError(files.length > room ? `A vehicle can have up to ${limits.max} photos.` : "");
    try {
      await uploadAll(vehicleId, chosen);
      await refreshMe();
    } finally {
      setBusy(false);
      setProgress("");
      setAddingTo(null);
    }
  }

  async function act(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
      await refreshMe();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(vehicleId: string, photoId: string) {
    setError("");
    try {
      await api.carDeleteVehiclePhoto(vehicleId, photoId);
      await refreshMe();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-5 px-4 py-5">
      <h1 className="text-2xl font-black text-ink">My vehicles</h1>
      {me.ownerStatus !== "approved" && <p className="text-xs text-ink-500">Your owner profile is being reviewed; your car is checked separately.</p>}
      {me.vehicles.length === 0 && <p className="text-sm text-ink-500">No vehicles yet — add your first below.</p>}
      {me.vehicles.map((v) => (
        <section key={v.id} className="home-card space-y-2">
          <p className="font-bold text-ink">{v.plate} <span className="font-normal text-ink-500">· {v.category_name}</span></p>
          <p className="text-xs text-ink-500">{[v.make, v.model].filter(Boolean).join(" ")}</p>
          <p className="text-xs text-ink-500">{v.service_class === "comfort" ? "Comfort" : "Convenient"}{v.condition_grade ? ` · ${v.condition_grade} condition` : ""}{v.seat_capacity ? ` · ${v.seat_capacity} seats` : ""}{v.last_service_date ? ` · last serviced ${v.last_service_date}` : ""}</p>
          {tiersEnabled && <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" disabled={busy} onClick={() => act(() => api.carUpdateRideService(v.id, "convenient", false))} className={`rounded-full px-3 py-2 ${v.service_class !== "comfort" ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink"}`}>Convenient first</button>
            <button type="button" disabled={busy} onClick={() => act(() => api.carUpdateRideService(v.id, "comfort", false))} className={`rounded-full px-3 py-2 ${v.service_class === "comfort" && !v.accepts_convenient ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink"}`}>Comfort only</button>
            <button type="button" disabled={busy} onClick={() => act(() => api.carUpdateRideService(v.id, "comfort", true))} className={`rounded-full px-3 py-2 ${v.service_class === "comfort" && !!v.accepts_convenient ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink"}`}>Comfort first · also Convenient</button>
          </div>}
          <p className="text-xs text-ink-500">
            {v.status === "approved" ? (v.driver_name ? `Driver: ${v.driver_name}` : "Approved — waiting for Peebee to assign a driver") : `Status: ${v.status}`}
          </p>
          {v.status === "approved" && approvedDriver && (!v.driver_id || v.driver_id === user?.id) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => (v.driver_id === user?.id ? api.carReleaseVehicle(v.id) : api.carDriveVehicle(v.id)))}
              className="min-h-10 rounded-full bg-gold/15 px-4 text-sm font-bold text-ink disabled:opacity-50"
            >
              {v.driver_id === user?.id ? "Stop driving this car" : "Drive this car myself"}
            </button>
          )}
          <Link
            href="/fuel"
            className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3 text-xs font-bold text-ink hover:bg-gold/15"
          >
            <Fuel className="h-3.5 w-3.5 text-gold" />
            <span>Fuel at partner stations (Peebee Gas) →</span>
          </Link>
          {dealLimits && dealVehicles.find((d) => d.id === v.id) && (
            <TermsEditor
              key={`${v.id}-${dealVehicles.find((d) => d.id === v.id)?.terms?.open}`}
              vehicle={dealVehicles.find((d) => d.id === v.id)!}
              limits={dealLimits}
              onSaved={() => api.dealsOwner().then((d) => setDealVehicles(d.vehicles)).catch(() => undefined)}
            />
          )}
          {v.photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {v.photos.map((photoId) => (
                <div key={photoId} className="relative">
                  <AuthImage vehicleId={v.id} photoId={photoId} className="block aspect-[4/3] w-full rounded-lg object-cover" />
                  <button type="button" onClick={() => remove(v.id, photoId)} aria-label="Remove photo" className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {v.photos.length < limits.max && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => { setAddingTo(v.id); addInput.current?.click(); }}
                className="flex min-h-10 items-center gap-2 text-sm font-bold text-gold disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />Add photos ({v.photos.length}/{limits.max})
              </button>
              {limits.minRequired > v.photos.length && v.status === "pending" && (
                <p className="text-xs text-ink-500">Add at least {limits.minRequired - v.photos.length} more photo{limits.minRequired - v.photos.length === 1 ? "" : "s"} so Peebee can approve it.</p>
              )}
            </>
          )}
        </section>
      ))}
      <input
        ref={addInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const vehicle = me.vehicles.find((v) => v.id === addingTo);
          void addToExisting(addingTo ?? "", e.target.files, vehicle?.photos.length ?? 0);
          e.target.value = "";
        }}
      />

      <form onSubmit={add} className="home-card space-y-3">
        <h2 className="font-bold">Add a vehicle</h2>
        <p className="text-xs text-ink-500">Follow the steps to create a complete vehicle profile. Your details help us review the car and help customers choose the right fit.</p>
        <h3 className="pt-1 text-sm font-bold text-ink">1 · Vehicle details</h3>
        <Select required value={categoryId} onValueChange={(value) => setCategoryId(value)} className={field} aria-label="Vehicle type">
          <option value="">Choose vehicle type…</option>
          {[...categories].sort((a, b) => groupRank(a) - groupRank(b)).map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.kind === "passenger" && c.seats ? ` (${c.seats} seats)` : ""}{c.service_group === "luxury" ? " · Luxury" : c.service_group === "ambulance" ? " · Ambulance" : ""}</option>
          ))}
        </Select>
        {specialSelected?.service_group === "luxury" && <p className="rounded-xl bg-gold/10 p-3 text-xs text-ink">Luxury cars get weddings, parties, red carpet and VIP bookings. Peebee checks the car and its condition before it can take them.</p>}
        {specialSelected?.service_group === "ambulance" && <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">Ambulances get emergency requests and are sent at once. Peebee checks the vehicle, its medical equipment and the crew&apos;s qualifications before it can take any. Add clear photos and keep your documents ready.</p>}
        <input required value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="Number plate" className={field} />
        <div className="grid grid-cols-2 gap-3">
          <Select required value={make} onValueChange={handleMakeChange} className={field} aria-label="Vehicle make">
            <option value="">Choose make…</option>
            {[...new Set(CAR_MODEL_CATALOG.map((m) => m.make))].sort().map((name) => <option key={name} value={name}>{name}</option>)}
            <option value="Other">Other / not listed</option>
          </Select>
          {make && make !== "Other" ? (
            <Select required value={modelCatalogId} onValueChange={handleModelSelect} className={field} aria-label="Vehicle model">
              <option value="">Choose model…</option>
              {CAR_MODEL_CATALOG.filter((m) => m.make === make && (bodyTypeFilter === "All" || getCarBodyType(m) === bodyTypeFilter)).map((m) => {
                const isVip = m.isVip ?? isVipRate(m.townDailyUgx ?? m.standardDailyUgx);
                return (
                  <option key={m.id} value={m.id}>
                    {isVip ? "👑 " : ""}{m.model}{m.variant ? ` · ${m.variant}` : ""} ({getCarBodyType(m)})
                  </option>
                );
              })}
            </Select>
          ) : <div className="space-y-2">{make === "Other" && <input required value={customMake} onChange={(e) => setCustomMake(e.target.value)} placeholder="Enter make name" className={field} />}<input required value={model} onChange={(e) => setModel(e.target.value)} placeholder="Enter model name" className={field} /></div>}
        </div>
        {make && make !== "Other" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-ink-500">
              <span>Body type helper</span>
              {bodyTypeFilter !== "All" && (
                <button type="button" onClick={() => handleBodyTypeChange("All")} className="text-xs font-semibold text-gold hover:underline">
                  Show all types
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["All", ...Array.from(new Set(CAR_MODEL_CATALOG.filter((m) => m.make === make).map((m) => getCarBodyType(m))))].map((bt) => (
                <button
                  key={bt}
                  type="button"
                  onClick={() => handleBodyTypeChange(bt)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    bodyTypeFilter === bt
                      ? "bg-gold text-ink-gold"
                      : "bg-[rgb(var(--surface-muted))] text-ink hover:bg-gold/15"
                  }`}
                >
                  {bt === "All" ? "All types" : bt}
                </button>
              ))}
            </div>
          </div>
        )}
        {systemHelperInfo && (
          <div className={`space-y-2 rounded-xl border p-3 text-xs ${
            systemHelperInfo.isVip ? "border-gold/40 bg-gold/15 text-ink" : "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-ink"
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 font-bold">
                {systemHelperInfo.isVip ? <Crown className="h-4 w-4 shrink-0 text-gold" /> : <Sparkles className="h-4 w-4 shrink-0 text-gold" />}
                <span>System Helper: {systemHelperInfo.model}</span>
              </div>
              {systemHelperInfo.isVip ? (
                <span className="rounded-full bg-gold/25 px-2 py-0.5 text-[11px] font-bold text-ink">
                  👑 VIP Fleet (≥ 500k/day)
                </span>
              ) : (
                <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-ink-500">
                  Standard Fleet (&lt; 500k/day)
                </span>
              )}
            </div>
            <p className="text-ink-500">
              Body: <strong className="text-ink">{systemHelperInfo.bodyType}</strong> · Seats: <strong className="text-ink">{systemHelperInfo.seatCapacity}</strong> · Suggested Plate: <strong className="font-mono text-ink">{systemHelperInfo.pseudoPlate}</strong>
            </p>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="rounded bg-black/5 px-2 py-0.5 dark:bg-white/10">
                Town benchmark: <strong>{systemHelperInfo.townDailyUgx.toLocaleString()} UGX/day</strong>
              </span>
              <span className="rounded bg-black/5 px-2 py-0.5 dark:bg-white/10">
                Upcountry benchmark: <strong>{systemHelperInfo.upcountryDailyUgx.toLocaleString()} UGX/day</strong>
              </span>
            </div>
            <p className="text-[10px] text-ink-500 italic">
              Category, seats, condition, and features were automatically populated. You can edit any value below.
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Select required value={year} onValueChange={setYear} className={field} aria-label="Vehicle model year"><option value="">Choose model year…</option>{Array.from({ length: new Date().getFullYear() - 1989 }, (_, i) => new Date().getFullYear() - i).map((y) => <option key={y} value={String(y)}>{y}</option>)}</Select>
          <Select value={colour} onValueChange={setColour} className={field} aria-label="Vehicle colour"><option value="">Choose colour…</option>{["White","Black","Silver","Grey","Blue","Red","Green","Brown","Gold","Other"].map((x) => <option key={x}>{x}</option>)}</Select>
        </div>
        {modelCatalogId && <p className="text-xs text-ink-500">Reference profile: {CAR_MODEL_CATALOG.find((m) => m.id === modelCatalogId)?.seats} seats · {Math.round((CAR_MODEL_CATALOG.find((m) => m.id === modelCatalogId)?.fuelLitresPerKm ?? 0) * 1000)} L/100 km. Actual fuel use varies by year, trim and condition.</p>}
        <h3 className="pt-1 text-sm font-bold text-ink">2 · Condition and care</h3>
        <div className="grid grid-cols-2 gap-3">
          {!specialSelected && <Select value={serviceClass} onValueChange={(v) => setServiceClass(v as typeof serviceClass)} className={field} aria-label="Vehicle class"><option value="convenient">Convenient · ordinary</option><option value="comfort">Comfort · newer or extra features</option></Select>}
          <Select value={conditionGrade} onValueChange={(v) => setConditionGrade(v as typeof conditionGrade)} className={field} aria-label="Vehicle condition"><option value="excellent">Excellent condition</option><option value="good">Good condition</option><option value="fair">Fair condition</option></Select>
        </div>
        {serviceClass === "comfort" && <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={acceptsConvenient} onChange={(e) => setAcceptsConvenient(e.target.checked)} />Also accept Convenient fares when no Comfort ride is available</label>}
        <Select required value={seatCapacity} onValueChange={setSeatCapacity} className={field} aria-label="Total seat capacity"><option value="">Choose total seats…</option>{Array.from({ length: 50 }, (_, i) => i + 1).map((n) => <option key={n} value={String(n)}>{n} seats</option>)}</Select>
        <label className="block space-y-1 text-xs font-semibold text-ink-500">Most recent service date<input required type="date" max={new Date().toISOString().slice(0, 10)} value={lastServiceDate} onChange={(e) => setLastServiceDate(e.target.value)} className={field} /></label>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-500">{["Air conditioning", "Bluetooth", "USB charging", "Child seat", "Automatic", "4WD"].map((feature) => <label key={feature} className="flex items-center gap-1.5"><input type="checkbox" checked={features.includes(feature)} onChange={(e) => setFeatures((prev) => e.target.checked ? [...prev, feature] : prev.filter((x) => x !== feature))} />{feature}</label>)}</div>

        <h3 className="pt-1 text-sm font-bold text-ink">3 · Vehicle photos</h3>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-500">
            Photos ({picked.length}/{limits.max}){limits.minRequired > 0 ? ` — at least ${limits.minRequired} needed` : ""}. Show the front, back, sides, inside and number plate.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {picked.map((p) => (
              <div key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" className="block aspect-[4/3] w-full rounded-lg object-cover" />
                <button type="button" onClick={() => drop(p.id)} aria-label="Remove photo" className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {picked.length < limits.max && (
              <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border-faint)] text-xs font-semibold text-ink-500">
                <Camera className="h-5 w-5" />
                Add
                <input type="file" accept="image/*" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <button disabled={busy} className="min-h-12 w-full rounded-full bg-gold font-bold text-ink-gold disabled:opacity-50">{busy ? progress || "Please wait…" : "Submit for approval"}</button>
      </form>
    </div>
  );
}
