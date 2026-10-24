"use client";

import { Clock, Info, LocateFixed, MapPin, Minus, Plus, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import { schedulePresets } from "../../lib/hive-home";
import { useRegisterNavBack, useRegisterNavPrimaryAction } from "../../lib/nav-primary-action";
import { cardClass, Notice, primaryBtn, Spinner, UnavailablePanel, WorkPage } from "./WorkUI";
import { WorkTopUp } from "./WorkTopUp";
import {
  formatUgx,
  newIdempotencyKey,
  toLocalInput,
  workFailure,
  type WorkFailure,
} from "./work-utils";

type LaundryItem = {
  id: string;
  name: string;
  category: string;
  maxCount: number;
  washUgx: number | null;
  dryCleanUgx: number | null;
  ironUgx: number | null;
  sortOrder: number;
  active: boolean;
};

type LaundryPackage = {
  id: string;
  name: string;
  description: string;
  minLb: number | null;
  maxLb: number | null;
  priceUgx: number;
  maxCount: number;
  sortOrder: number;
  active: boolean;
};

type LaundryCatalogData = {
  items: LaundryItem[];
  packages: LaundryPackage[];
  settings: {
    pricing: Record<string, "fixed" | "estimate">;
    offer: { minPercent: number; maxPercent: number; stepUgx: number };
    tips: { freeEnabled: boolean; conditionalEnabled: boolean; maxUgx: number; stepUgx: number; ontimeHours: number };
    rides: { pickupPayer: string; deliveryPayer: string; splitCustomerPercent: number };
    overageUgxPerLb: number;
  };
};

type QuoteData = {
  currency: string;
  lines: Array<{ itemId: string; treatment: string; count: number; unitUgx: number; lineUgx: number; name?: string }>;
  packageLines: Array<{ packageId: string; name: string; count: number; unitUgx: number; lineUgx: number }>;
  catalogueUgx: number;
  pricingMode: "fixed" | "estimate";
  offerBand: { minUgx: number; averageUgx: number; maxUgx: number; stepUgx: number } | null;
  goodsUgx: number;
  tip: { kind: string; amountUgx: number };
  rides: { customerUgx: number; providerUgx: number; pickup: { customer: number; provider: number }; delivery: { customer: number; provider: number } };
  customerFeeUgx: number;
  customerTotalUgx: number;
};

export function LaundryBooking() {
  const router = useRouter();
  useRegisterNavBack(true, () => router.push("/services"));

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LaundryCatalogData | null>(null);
  const [loadError, setLoadError] = useState<WorkFailure | null>(null);

  // Tab: "packages" | "custom"
  const [mode, setMode] = useState<"packages" | "custom">("packages");

  // Selection
  const [pkgCounts, setPkgCounts] = useState<Record<string, number>>({});
  const [itemSelections, setItemSelections] = useState<Record<string, { treatment: "wash" | "dry_clean" | "iron"; count: number }>>({});

  // Offer
  const [offerUgx, setOfferUgx] = useState<number | null>(null);

  // Tip
  const [tipKind, setTipKind] = useState<"none" | "free" | "conditional">("none");
  const [tipUgx, setTipUgx] = useState<number>(0);

  // Preferences & Pickup
  const [frequency, setFrequency] = useState<"one_time" | "weekly" | "biweekly">("one_time");
  const [detergent, setDetergent] = useState<"standard" | "fragrance_free">("standard");
  const [contactless, setContactless] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");

  // Location & Schedule
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});
  const [locating, setLocating] = useState(false);
  const [when, setWhen] = useState<"now" | "preset" | "custom">("now");
  const [scheduledFor, setScheduledFor] = useState<string>("");

  // Live Quote
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Order submission
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<WorkFailure | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [topUp, setTopUp] = useState<{ needed: number; nonce: number } | null>(null);
  const nonce = useRef(0);
  const keyRef = useRef<{ sig: string; key: string } | null>(null);

  // Load catalog
  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.laundryCatalog();
      setData(res);
      // Pre-select first active package if present
      const firstPkg = res.packages.find((p: LaundryPackage) => p.active && p.priceUgx > 0);
      if (firstPkg) {
        setPkgCounts({ [firstPkg.id]: 1 });
      }
    } catch (err) {
      setLoadError(workFailure(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  // Read saved address
  useEffect(() => {
    try {
      const raw = localStorage.getItem("peebee_current_location");
      if (raw) {
        const loc = JSON.parse(raw);
        if (loc?.address) setAddress(loc.address);
        if (loc?.name) setArea(loc.name);
        if (loc?.lat && loc?.lng) setCoords({ lat: loc.lat, lng: loc.lng });
      }
    } catch {}
  }, []);

  // Update live quote
  const buildQuoteInput = useCallback(() => {
    const packages = Object.entries(pkgCounts)
      .filter(([, count]) => count > 0)
      .map(([packageId, count]) => ({ packageId, count }));

    const items = Object.entries(itemSelections)
      .filter(([, val]) => val.count > 0)
      .map(([itemId, val]) => ({ itemId, treatment: val.treatment, count: val.count }));

    return {
      packages: mode === "packages" ? packages : [],
      items: mode === "custom" ? items : [],
      offerUgx: offerUgx ?? undefined,
      tip: tipKind !== "none" && tipUgx > 0 ? { kind: tipKind, amountUgx: tipUgx } : undefined,
    };
  }, [mode, pkgCounts, itemSelections, offerUgx, tipKind, tipUgx]);

  const refreshQuote = useCallback(async () => {
    const input = buildQuoteInput();
    if (input.packages.length === 0 && input.items.length === 0) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    try {
      const q = await api.laundryQuote(input);
      setQuote(q);
      if (q.pricingMode === "estimate" && q.offerBand && offerUgx === null) {
        setOfferUgx(q.offerBand.averageUgx);
      }
    } catch {
      // Degrade gracefully
    } finally {
      setQuoteLoading(false);
    }
  }, [buildQuoteInput, offerUgx]);

  useEffect(() => {
    const t = setTimeout(() => {
      void refreshQuote();
    }, 250);
    return () => clearTimeout(t);
  }, [refreshQuote]);

  // GPS locate
  const locateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (!address) setAddress("Current Location");
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Submission
  const attemptOrder = async () => {
    setLocalError(null);
    setFailure(null);
    if (!address.trim()) {
      setLocalError("Please enter your pickup and delivery address.");
      return;
    }
    const input = buildQuoteInput();
    if (input.packages.length === 0 && input.items.length === 0) {
      setLocalError("Please select at least one package or clothing item.");
      return;
    }

    const payload = {
      ...input,
      address: address.trim(),
      area: area.trim() || undefined,
      lat: coords.lat,
      lng: coords.lng,
      scheduledFor: when === "now" ? undefined : scheduledFor || undefined,
      frequency,
      detergent,
      contactless,
      notes: notes.trim() || undefined,
      expectedTotalUgx: quote?.customerTotalUgx,
    };

    const sig = JSON.stringify(payload);
    if (!keyRef.current || keyRef.current.sig !== sig) {
      keyRef.current = { sig, key: newIdempotencyKey() };
    }

    setBusy(true);
    try {
      const res = await api.laundryOrder({ ...payload, idempotencyKey: keyRef.current.key });
      setTopUp(null);
      router.push(`/services/work/${encodeURIComponent(res.job.id)}`);
    } catch (err) {
      const f = workFailure(err);
      setFailure(f);
      if (f.topUp) {
        const needed = quote?.customerTotalUgx ?? 0;
        nonce.current += 1;
        setTopUp(needed > 0 ? { needed, nonce: nonce.current } : null);
      } else {
        setTopUp(null);
      }
      setBusy(false);
    }
  };

  const totalLabel = quote ? formatUgx(quote.customerTotalUgx) : "...";
  const primaryAction = useMemo(() => {
    if (loading || loadError) return null;
    return {
      tone: "gold" as const,
      label: busy ? "Confirming..." : `Book & Pay ${totalLabel}`,
      sublabel: "In-app payment held securely",
      icon: Wallet,
      busy,
      disabled: busy || quoteLoading || !quote,
      onClick: () => void attemptOrder(),
    };
  }, [loading, loadError, busy, totalLabel, quoteLoading, quote]);

  useRegisterNavPrimaryAction(primaryAction);

  if (loading) {
    return (
      <WorkPage eyebrow="Work" title="Laundry" backHref="/services" backLabel="Services">
        <div className="flex h-64 items-center justify-center">
          <Spinner label="Loading laundry services..." />
        </div>
      </WorkPage>
    );
  }

  if (loadError || !data) {
    return (
      <WorkPage eyebrow="Work" title="Laundry" backHref="/services" backLabel="Services">
        <UnavailablePanel title="Laundry Unavailable" message={loadError?.message ?? "Could not load laundry services."} backHref="/services" />
      </WorkPage>
    );
  }

  return (
    <WorkPage eyebrow="Work" title="Laundry & Dry Cleaning" backHref="/services" backLabel="Services">
      <div className="space-y-6">
        {/* Service Mode Selector */}
        <div className="flex rounded-2xl bg-[var(--surface-sunken)] p-1">
          <button
            type="button"
            onClick={() => {
              setMode("packages");
              setOfferUgx(null);
            }}
            className={`flex-1 rounded-xl py-2.5 text-center text-sm font-semibold transition ${
              mode === "packages" ? "bg-[var(--surface-raised)] text-ink shadow-sm" : "text-ink-500 hover:text-ink"
            }`}
          >
            Wash & Fold Packages
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("custom");
              setOfferUgx(null);
            }}
            className={`flex-1 rounded-xl py-2.5 text-center text-sm font-semibold transition ${
              mode === "custom" ? "bg-[var(--surface-raised)] text-ink shadow-sm" : "text-ink-500 hover:text-ink"
            }`}
          >
            Custom Item Order
          </button>
        </div>

        {/* Packages Mode */}
        {mode === "packages" && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">Choose your load size</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.packages.map((pkg) => {
                const count = pkgCounts[pkg.id] ?? 0;
                return (
                  <div key={pkg.id} className={`${cardClass} flex flex-col justify-between`}>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink">{pkg.name}</span>
                        <span className="font-bold text-ink">{formatUgx(pkg.priceUgx)}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-500">
                        {pkg.description || (pkg.minLb && pkg.maxLb ? `${pkg.minLb}–${pkg.maxLb} lbs` : "Per load")}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-[var(--border-faint)] pt-3">
                      <span className="text-xs text-ink-500">Quantity</span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setPkgCounts((prev) => ({ ...prev, [pkg.id]: Math.max(0, count - 1) }))}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-faint)] text-ink"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-semibold text-ink">{count}</span>
                        <button
                          type="button"
                          onClick={() => setPkgCounts((prev) => ({ ...prev, [pkg.id]: Math.min(pkg.maxCount, count + 1) }))}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-faint)] text-ink"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {data.settings.overageUgxPerLb > 0 && (
              <p className="text-xs text-ink-500">
                Additional weight beyond load capacity is {formatUgx(data.settings.overageUgxPerLb)}/lb (weighed upon collection).
              </p>
            )}
          </div>
        )}

        {/* Custom Item Count Mode */}
        {mode === "custom" && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">Select clothes by type and count</h3>
            <div className="space-y-2">
              {data.items.map((item) => {
                const current = itemSelections[item.id] ?? { treatment: item.washUgx ? "wash" : item.dryCleanUgx ? "dry_clean" : "iron", count: 0 };
                return (
                  <div key={item.id} className={`${cardClass} flex items-center justify-between gap-3 py-3`}>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink">{item.name}</div>
                      {/* Treatment selector */}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.washUgx != null && item.washUgx > 0 && (
                          <button
                            type="button"
                            onClick={() => setItemSelections((prev) => ({ ...prev, [item.id]: { ...current, treatment: "wash" } }))}
                            className={`rounded-lg px-2 py-0.5 text-xs font-medium transition ${
                              current.treatment === "wash" ? "bg-[var(--gold)] text-ink" : "bg-[var(--surface-sunken)] text-ink-500"
                            }`}
                          >
                            Wash {formatUgx(item.washUgx)}
                          </button>
                        )}
                        {item.dryCleanUgx != null && item.dryCleanUgx > 0 && (
                          <button
                            type="button"
                            onClick={() => setItemSelections((prev) => ({ ...prev, [item.id]: { ...current, treatment: "dry_clean" } }))}
                            className={`rounded-lg px-2 py-0.5 text-xs font-medium transition ${
                              current.treatment === "dry_clean" ? "bg-[var(--gold)] text-ink" : "bg-[var(--surface-sunken)] text-ink-500"
                            }`}
                          >
                            Dry Clean {formatUgx(item.dryCleanUgx)}
                          </button>
                        )}
                        {item.ironUgx != null && item.ironUgx > 0 && (
                          <button
                            type="button"
                            onClick={() => setItemSelections((prev) => ({ ...prev, [item.id]: { ...current, treatment: "iron" } }))}
                            className={`rounded-lg px-2 py-0.5 text-xs font-medium transition ${
                              current.treatment === "iron" ? "bg-[var(--gold)] text-ink" : "bg-[var(--surface-sunken)] text-ink-500"
                            }`}
                          >
                            Iron {formatUgx(item.ironUgx)}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Stepper */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setItemSelections((prev) => ({
                            ...prev,
                            [item.id]: { ...current, count: Math.max(0, current.count - 1) },
                          }))
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-faint)] text-ink"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm font-semibold text-ink">{current.count}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setItemSelections((prev) => ({
                            ...prev,
                            [item.id]: { ...current, count: Math.min(item.maxCount, current.count + 1) },
                          }))
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-faint)] text-ink"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Offer Slider (when in Estimate mode) */}
        {quote?.pricingMode === "estimate" && quote.offerBand && (
          <div className={`${cardClass} space-y-3`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-ink">Your Offer Price</span>
                <p className="text-xs text-ink-500">Service providers can accept or counter your offer.</p>
              </div>
              <span className="text-base font-bold text-[var(--gold-text,#926500)]">
                {formatUgx(offerUgx ?? quote.offerBand.averageUgx)}
              </span>
            </div>
            <input
              type="range"
              min={quote.offerBand.minUgx}
              max={quote.offerBand.maxUgx}
              step={quote.offerBand.stepUgx}
              value={offerUgx ?? quote.offerBand.averageUgx}
              onChange={(e) => setOfferUgx(Number(e.target.value))}
              className="w-full accent-[var(--gold)]"
            />
            <div className="flex justify-between text-xs text-ink-500">
              <span>Min: {formatUgx(quote.offerBand.minUgx)}</span>
              <span>Avg: {formatUgx(quote.offerBand.averageUgx)}</span>
              <span>Max: {formatUgx(quote.offerBand.maxUgx)}</span>
            </div>
          </div>
        )}

        {/* Tip (Free / Conditional) */}
        {(data.settings.tips.freeEnabled || data.settings.tips.conditionalEnabled) && (
          <div className={`${cardClass} space-y-3`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Add a Tip</span>
              <span className="text-xs text-ink-500">Optional</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTipKind("none");
                  setTipUgx(0);
                }}
                className={`rounded-xl py-2 text-xs font-semibold transition ${
                  tipKind === "none" ? "bg-[var(--gold)] text-ink" : "bg-[var(--surface-sunken)] text-ink-500"
                }`}
              >
                No Tip
              </button>
              {data.settings.tips.freeEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setTipKind("free");
                    if (tipUgx === 0) setTipUgx(2000);
                  }}
                  className={`rounded-xl py-2 text-xs font-semibold transition ${
                    tipKind === "free" ? "bg-[var(--gold)] text-ink" : "bg-[var(--surface-sunken)] text-ink-500"
                  }`}
                >
                  Direct Tip
                </button>
              )}
              {data.settings.tips.conditionalEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setTipKind("conditional");
                    if (tipUgx === 0) setTipUgx(2000);
                  }}
                  className={`rounded-xl py-2 text-xs font-semibold transition ${
                    tipKind === "conditional" ? "bg-[var(--gold)] text-ink" : "bg-[var(--surface-sunken)] text-ink-500"
                  }`}
                >
                  On-Time Tip
                </button>
              )}
            </div>
            {tipKind === "conditional" && (
              <p className="text-xs text-ink-500">
                Released only if your laundry is delivered on-schedule and without disputes; refunded otherwise.
              </p>
            )}
            {tipKind !== "none" && (
              <div className="flex items-center gap-2 pt-1">
                {[1000, 2000, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTipUgx(amt)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                      tipUgx === amt ? "bg-ink text-[var(--surface)]" : "bg-[var(--surface-sunken)] text-ink"
                    }`}
                  >
                    {formatUgx(amt)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Preferences */}
        <div className={`${cardClass} space-y-3`}>
          <span className="text-sm font-semibold text-ink">Preferences</span>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-ink-500">Frequency</label>
              <div className="mt-1 flex gap-2">
                {[
                  { id: "one_time", label: "One-time" },
                  { id: "weekly", label: "Weekly" },
                  { id: "biweekly", label: "Biweekly" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFrequency(f.id as any)}
                    className={`flex-1 rounded-xl py-2 text-xs font-medium transition ${
                      frequency === f.id ? "bg-[var(--gold)] text-ink" : "bg-[var(--surface-sunken)] text-ink-500"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-ink-500">Detergent</label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDetergent("standard")}
                  className={`flex-1 rounded-xl py-2 text-xs font-medium transition ${
                    detergent === "standard" ? "bg-[var(--gold)] text-ink" : "bg-[var(--surface-sunken)] text-ink-500"
                  }`}
                >
                  Standard Detergent
                </button>
                <button
                  type="button"
                  onClick={() => setDetergent("fragrance_free")}
                  className={`flex-1 rounded-xl py-2 text-xs font-medium transition ${
                    detergent === "fragrance_free" ? "bg-[var(--gold)] text-ink" : "bg-[var(--surface-sunken)] text-ink-500"
                  }`}
                >
                  Fragrance-Free
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 pt-1 text-xs text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={contactless}
                onChange={(e) => setContactless(e.target.checked)}
                className="h-4 w-4 rounded accent-[var(--gold)]"
              />
              Contactless pickup & door delivery
            </label>
            <input
              type="text"
              placeholder="Special care notes or access instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-faint)] bg-transparent px-3 py-2 text-xs text-ink"
            />
          </div>
        </div>

        {/* Pickup & Delivery Location */}
        <div className={`${cardClass} space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Pickup & Delivery Address</span>
            <button
              type="button"
              onClick={locateMe}
              disabled={locating}
              className="flex items-center gap-1 text-xs font-medium text-[var(--gold-text,#926500)]"
            >
              <LocateFixed className="h-3.5 w-3.5" />
              {locating ? "Locating..." : "Use GPS"}
            </button>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
              <input
                type="text"
                placeholder="Street address or building..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-faint)] bg-transparent pl-9 pr-3 py-2 text-xs text-ink"
              />
            </div>
            <input
              type="text"
              placeholder="Area / Neighborhood (e.g. Kololo, Ntinda)"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-faint)] bg-transparent px-3 py-2 text-xs text-ink"
            />
          </div>
        </div>

        {/* Schedule */}
        <div className={`${cardClass} space-y-3`}>
          <span className="text-sm font-semibold text-ink">Collection Time</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setWhen("now");
                setScheduledFor("");
              }}
              className={`flex-1 rounded-xl py-2 text-xs font-medium transition ${
                when === "now" ? "bg-[var(--gold)] text-ink" : "bg-[var(--surface-sunken)] text-ink-500"
              }`}
            >
              Pickup Soon
            </button>
            <button
              type="button"
              onClick={() => {
                setWhen("custom");
                if (!scheduledFor) {
                  const d = new Date(Date.now() + 3600 * 1000);
                  setScheduledFor(toLocalInput(d));
                }
              }}
              className={`flex-1 rounded-xl py-2 text-xs font-medium transition ${
                when === "custom" ? "bg-[var(--gold)] text-ink" : "bg-[var(--surface-sunken)] text-ink-500"
              }`}
            >
              Schedule Date & Hour
            </button>
          </div>
          {when === "custom" && (
            <div className="relative pt-1">
              <Clock className="absolute left-3 top-3.5 h-4 w-4 text-ink-400" />
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-faint)] bg-transparent pl-9 pr-3 py-2 text-xs text-ink"
              />
            </div>
          )}
        </div>

        {/* Cost Summary Breakdown */}
        {quote && (
          <div className={`${cardClass} space-y-2 text-xs`}>
            <div className="flex justify-between text-ink-500">
              <span>Laundry Service Total</span>
              <span className="font-medium text-ink">{formatUgx(quote.goodsUgx)}</span>
            </div>
            {quote.rides.customerUgx > 0 && (
              <div className="flex justify-between text-ink-500">
                <span>Rider Pickup & Delivery Share</span>
                <span className="font-medium text-ink">{formatUgx(quote.rides.customerUgx)}</span>
              </div>
            )}
            {quote.tip.amountUgx > 0 && (
              <div className="flex justify-between text-ink-500">
                <span>Tip ({quote.tip.kind === "conditional" ? "On-Time" : "Direct"})</span>
                <span className="font-medium text-ink">{formatUgx(quote.tip.amountUgx)}</span>
              </div>
            )}
            {quote.customerFeeUgx > 0 && (
              <div className="flex justify-between text-ink-500">
                <span>Peebee Service Fee</span>
                <span className="font-medium text-ink">{formatUgx(quote.customerFeeUgx)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[var(--border-faint)] pt-2 text-sm font-bold text-ink">
              <span>Total Payable</span>
              <span>{formatUgx(quote.customerTotalUgx)}</span>
            </div>
          </div>
        )}

        {/* Notices & Wallet Top-up */}
        <Notice text={localError ?? undefined} />
        <Notice failure={failure} inlineTopUp={!!topUp} />
        {topUp && <WorkTopUp key={topUp.nonce} neededUgx={topUp.needed} onCredited={() => void attemptOrder()} />}

        {/* Primary Checkout Button */}
        <button
          type="button"
          disabled={busy || !quote}
          onClick={() => void attemptOrder()}
          className={`${primaryBtn} flex items-center justify-center gap-2 py-3.5 font-bold shadow-md`}
        >
          <Wallet className="h-4 w-4" />
          {busy ? "Confirming Order..." : `Confirm & Pay with Wallet • ${totalLabel}`}
        </button>

        <p className="text-center text-xs text-ink-500">
          Funds are held safely in your Peebee wallet and released to providers and riders upon delivery.
        </p>
      </div>
    </WorkPage>
  );
}
