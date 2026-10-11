"use client";

import type { FuelCode, FuelProduct, FuelReceipt, FuelStationOutlet } from "@peebee/shared";
import {
  ArrowLeft,
  Building2,
  CarFront,
  Check,
  Clock,
  Copy,
  Fuel,
  Info,
  MapPin,
  QrCode,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FuelQrCode } from "../../components/FuelQrCode";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

export default function PartnerFuelPage() {
  const { me } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCode, setActiveCode] = useState<FuelCode | null>(null);
  const [stations, setStations] = useState<FuelStationOutlet[]>([]);
  const [products, setProducts] = useState<FuelProduct[]>([]);
  const [dispenses, setDispenses] = useState<FuelReceipt[]>([]);
  const [copied, setCopied] = useState(false);

  // Available vehicles for this driver / partner
  const allVehicles = [
    ...(me?.vehicles ?? []),
    ...(me?.assignedVehicles ?? []),
  ];
  const [selectedVehiclePlate, setSelectedVehiclePlate] = useState<string>(
    allVehicles[0]?.plate ?? "UBK 902F"
  );

  // Generation form
  const [amountUgx, setAmountUgx] = useState<number>(50_000);
  const [selectedProductId, setSelectedProductId] = useState<string>("prod_petrol");
  const [generating, setGenerating] = useState<boolean>(false);
  const [remainingTime, setRemainingTime] = useState<string>("");

  useEffect(() => {
    if (allVehicles.length > 0 && !allVehicles.some((v) => v.plate === selectedVehiclePlate)) {
      setSelectedVehiclePlate(allVehicles[0].plate);
    }
  }, [allVehicles, selectedVehiclePlate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [codeRes, stationsRes, productsRes, dispensesRes] = await Promise.all([
        api.getActiveRiderFuelCode().catch(() => ({ code: null })),
        api.gasStations().catch(() => ({ outlets: [] })),
        api.gasProducts().catch(() => ({ products: [] })),
        api.gasDispenses().catch(() => ({ dispenses: [] })),
      ]);

      setActiveCode(codeRes.code);
      setStations(stationsRes.outlets);
      setProducts(productsRes.products);
      setDispenses(dispensesRes.dispenses);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Expiry countdown timer
  useEffect(() => {
    if (!activeCode?.expires_at) {
      setRemainingTime("");
      return;
    }

    function updateCountdown() {
      const diff = new Date(activeCode!.expires_at).getTime() - Date.now();
      if (diff <= 0) {
        setRemainingTime("Expired");
        return;
      }
      const mins = Math.floor(diff / 60_000);
      const secs = Math.floor((diff % 60_000) / 1000);
      setRemainingTime(`${mins}m ${secs.toString().padStart(2, "0")}s`);
    }

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [activeCode]);

  async function handleGenerateCode() {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.generateRiderFuelCode({
        vehiclePlate: selectedVehiclePlate,
        amountUgx,
        productId: selectedProductId,
      });
      if (res.ok && res.code) {
        setActiveCode(res.code);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  function handleCopyCode() {
    if (!activeCode) return;
    const cleanPin = activeCode.code.replace(/^PBGAS-/, "");
    void navigator.clipboard.writeText(cleanPin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const cleanDisplayPin = activeCode?.code
    ? activeCode.code.replace(/^PBGAS-/, "").replace(/(\d{3})(\d{3})/, "$1 $2")
    : "";

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-4 pb-20">
      {/* Top Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface))] text-ink"
            aria-label="Back to Home"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 items-center gap-1 rounded-md bg-gold/15 px-1.5 text-[10px] font-black uppercase text-gold">
                <Fuel className="h-3 w-3" />
                Peebee Gas
              </span>
              <span className="text-xs text-ink-500">Driver Fuel Network</span>
            </div>
            <h1 className="text-lg font-black text-ink">Car Fuel Voucher & Stations</h1>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface))] text-ink hover:bg-[rgb(var(--surface-muted))]"
          title="Refresh fuel status"
        >
          <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ACTIVE FUEL VOUCHER SECTION */}
      {activeCode && remainingTime !== "Expired" ? (
        <section className="home-card space-y-4 border-2 border-gold/40 bg-[rgb(var(--surface))] text-center">
          <div className="flex items-center justify-between border-b border-[var(--border-faint)] pb-3 text-xs">
            <span className="flex items-center gap-1.5 font-bold text-green">
              <ShieldCheck className="h-4 w-4" />
              Active Car Fuel Voucher
            </span>
            <span className="flex items-center gap-1 font-mono font-bold text-ink-500">
              <Clock className="h-3.5 w-3.5 text-gold" />
              {remainingTime}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
              6-Digit Pump Attendant PIN
            </span>
            <div className="mt-1 flex items-center justify-center gap-3">
              <span className="font-mono text-3xl font-black tracking-widest text-ink">
                {cleanDisplayPin}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-ink hover:bg-gold/15 hover:text-gold"
                title="Copy PIN"
              >
                {copied ? <Check className="h-4 w-4 text-green" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Show or read this PIN to the petrol station attendant at the pump
            </p>
          </div>

          {/* QR Code Presentation */}
          <div className="flex flex-col items-center justify-center pt-2">
            <FuelQrCode value={activeCode.code} size={180} />
            <span className="mt-2 text-[11px] font-bold text-ink-500">
              or let the attendant scan this QR code
            </span>
          </div>

          {/* Authorized Details Box */}
          <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-3 text-left text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-ink-500">Vehicle Plate:</span>
              <strong className="font-mono text-ink">{activeCode.vehicle_plate}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Fuel Grade:</span>
              <strong className="text-ink">
                {activeCode.fuel_product_id === "prod_diesel"
                  ? "Automotive Diesel"
                  : "Unleaded Petrol"}
              </strong>
            </div>
            <div className="flex justify-between border-t border-[var(--border-faint)] pt-1.5 font-bold">
              <span className="text-ink-500">Allowance Limit:</span>
              <span className="text-gold">
                UGX {activeCode.authorized_amount_ugx.toLocaleString()}
              </span>
            </div>
          </div>
        </section>
      ) : (
        /* GENERATE VOUCHER CARD */
        <section className="home-card space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold">
              <CarFront className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-sm font-black text-ink">Get Car Fuel Voucher</h2>
              <p className="text-xs text-ink-500">
                Pump fuel for your registered car at partner stations without cash
              </p>
            </div>
          </div>

          {/* Vehicle Selector */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-ink-500">
              Select Registered Car
            </label>
            {allVehicles.length > 0 ? (
              <select
                value={selectedVehiclePlate}
                onChange={(e) => setSelectedVehiclePlate(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 text-xs font-bold text-ink outline-none"
              >
                {allVehicles.map((v) => (
                  <option key={v.id} value={v.plate}>
                    {v.plate} — {v.make ?? "Car"} {v.model ?? ""} ({v.category_name})
                  </option>
                ))}
              </select>
            ) : (
              <div className="field-box flex items-center gap-2 p-3">
                <CarFront className="h-4 w-4 text-gold" />
                <input
                  type="text"
                  value={selectedVehiclePlate}
                  onChange={(e) => setSelectedVehiclePlate(e.target.value.toUpperCase())}
                  placeholder="e.g. UBK 902F"
                  className="w-full font-mono text-xs font-bold text-ink"
                />
              </div>
            )}
          </div>

          {/* Amount selector chips (tuned for cars) */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-ink-500">
              Fuel Allowance (UGX)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[30_000, 50_000, 100_000, 150_000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmountUgx(amt)}
                  className={`rounded-xl border py-2 text-xs font-bold transition ${
                    amountUgx === amt
                      ? "border-gold bg-gold text-ink-gold font-black"
                      : "border-[var(--border-faint)] bg-[rgb(var(--surface-input))] text-ink"
                  }`}
                >
                  {amt / 1000}k
                </button>
              ))}
            </div>
          </div>

          {/* Fuel Product Selector */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-ink-500">
              Fuel Grade
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedProductId("prod_petrol")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs transition ${
                  selectedProductId === "prod_petrol"
                    ? "border-gold bg-gold/10 font-black text-ink"
                    : "border-[var(--border-faint)] bg-[rgb(var(--surface-input))] font-bold text-ink-500"
                }`}
              >
                <Fuel className="h-4 w-4 text-gold" />
                <span>Petrol (UGX 5,450/L)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedProductId("prod_diesel")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs transition ${
                  selectedProductId === "prod_diesel"
                    ? "border-navy bg-navy/10 font-black text-ink"
                    : "border-[var(--border-faint)] bg-[rgb(var(--surface-input))] font-bold text-ink-500"
                }`}
              >
                <Fuel className="h-4 w-4 text-navy" />
                <span>Diesel (UGX 5,200/L)</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateCode}
            disabled={generating}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold font-bold text-ink-gold shadow-sm hover:opacity-95 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>{generating ? "Generating..." : "Generate Car Fuel Voucher"}</span>
          </button>
        </section>
      )}

      {/* HOW IT WORKS / GUIDE */}
      <section className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 space-y-2 text-xs">
        <div className="flex items-center gap-2 font-black text-ink">
          <Info className="h-4 w-4 text-gold" />
          <span>How Car Drivers Fuel at Partner Stations</span>
        </div>
        <ol className="list-decimal space-y-1 pl-4 leading-relaxed text-ink-500">
          <li>Drive into any partner petrol station lane below.</li>
          <li>Tell the pump attendant you are paying with Peebee Gas.</li>
          <li>Give them your 6-digit PIN or show the QR code on your phone.</li>
          <li>Attendant confirms your number plate and dispenses the fuel.</li>
        </ol>
      </section>

      {/* NEARBY PARTNER PETROL STATIONS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-black text-ink">Partner Stations (Shell, Total, Rubis)</h2>
          </div>
          <span className="text-xs font-bold text-ink-500">{stations.length} stations</span>
        </div>

        <div className="space-y-2.5">
          {stations.map((st) => (
            <article
              key={st.id}
              className="home-card flex items-start justify-between p-3.5 transition hover:border-gold/50"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-gold/15 px-2 py-0.5 text-[10px] font-black uppercase text-gold">
                    {st.station_name}
                  </span>
                  <h3 className="text-xs font-black text-ink">{st.name}</h3>
                </div>
                <p className="flex items-center gap-1 text-[11px] text-ink-500">
                  <MapPin className="h-3 w-3 shrink-0 text-ink-500" />
                  <span>{st.address}</span>
                </p>
                <div className="flex items-center gap-3 pt-1 text-[11px]">
                  <span className="font-bold text-ink">
                    Petrol: <strong className="text-gold">UGX 5,450/L</strong>
                  </span>
                  <span className="font-bold text-ink">
                    Diesel: <strong className="text-navy">UGX 5,200/L</strong>
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end justify-between">
                <span className="rounded-full bg-green/15 px-2 py-0.5 text-[10px] font-bold text-green">
                  Open 24/7
                </span>
                <span className="mt-4 font-mono text-[11px] text-ink-500">
                  {st.code}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* RECENT FUEL DISPENSES */}
      {dispenses.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-black text-ink">Recent Fuel Receipts</h2>
          </div>

          <div className="space-y-2">
            {dispenses.slice(0, 5).map((d) => (
              <div
                key={d.id}
                className="home-card flex items-center justify-between p-3 text-xs"
              >
                <div className="space-y-0.5">
                  <span className="font-mono text-[11px] font-bold text-gold">
                    {d.receipt_ref}
                  </span>
                  <div className="font-bold text-ink">
                    {d.litres_dispensed}L {d.product_name}
                  </div>
                  <p className="text-[10px] text-ink-500">
                    {new Date(d.created_at).toLocaleDateString()} · {d.outlet_name}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-black text-green">
                    UGX {d.total_ugx.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-ink-500 font-mono">
                    Pump #{d.pump_number}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
