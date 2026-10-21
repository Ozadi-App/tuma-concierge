"use client";

import { receiptUrl, type FuelCode, type FuelOutletPrice, type FuelReceipt } from "@peebee/shared";
import { QrCode } from "@peebee/shared/qr-code";
import {
  AlertCircle,
  ArrowLeft,
  Bike,
  CarFront,
  CheckCircle2,
  Printer,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

function DispenseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCode = searchParams.get("code") ?? "";
  const { attendant, outlet, refreshShift } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codeData, setCodeData] = useState<FuelCode | null>(null);
  const [prices, setPrices] = useState<FuelOutletPrice[]>([]);

  // Dispense Form State
  const [selectedProductId, setSelectedProductId] = useState("prod_petrol");
  const [pumpNumber, setPumpNumber] = useState(1);
  const [amountUgx, setAmountUgx] = useState("20000");
  const [litres, setLitres] = useState("");
  const [inputMode, setInputMode] = useState<"ugx" | "litres">("ugx");
  const [dispensing, setDispensing] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<FuelReceipt | null>(null);

  const ugx = (amount: number) => `UGX ${Number(amount).toLocaleString()}`;

  // Current active unit price
  const activeProduct = prices.find((p) => p.product_id === selectedProductId) ?? prices[0];
  const unitPrice = activeProduct?.price_per_unit ?? 5450;

  // Load code verification
  useEffect(() => {
    if (!rawCode) {
      router.replace("/");
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.verifyGasCode(rawCode, outlet?.id);
        if (res.valid) {
          setCodeData(res.code);
          setPrices(res.outlet_prices);
          if (res.code.fuel_product_id) {
            setSelectedProductId(res.code.fuel_product_id);
          }
          // Default amount: either code authorized amount or preset 20,000
          const initialUgx = Math.min(20000, res.code.authorized_amount_ugx);
          setAmountUgx(String(initialUgx));
          setLitres((initialUgx / unitPrice).toFixed(2));
        }
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [rawCode, outlet?.id, router, unitPrice]);

  // Recalculate when amount or product changes
  function handleUgxChange(newAmount: string) {
    const val = newAmount.replace(/[^\d]/g, "");
    setAmountUgx(val);
    setInputMode("ugx");
    const num = Number(val) || 0;
    if (num > 0 && unitPrice > 0) {
      setLitres((num / unitPrice).toFixed(2));
    } else {
      setLitres("");
    }
  }

  function handleLitresChange(newLitres: string) {
    setLitres(newLitres);
    setInputMode("litres");
    const num = Number(newLitres) || 0;
    if (num > 0 && unitPrice > 0) {
      setAmountUgx(String(Math.round(num * unitPrice)));
    } else {
      setAmountUgx("");
    }
  }

  function handleProductChange(productId: string) {
    setSelectedProductId(productId);
    const prod = prices.find((p) => p.product_id === productId);
    const price = prod?.price_per_unit ?? 5450;
    if (inputMode === "ugx") {
      const num = Number(amountUgx) || 0;
      setLitres(num > 0 ? (num / price).toFixed(2) : "");
    } else {
      const num = Number(litres) || 0;
      setAmountUgx(num > 0 ? String(Math.round(num * price)) : "");
    }
  }

  async function handleConfirmDispense() {
    if (!codeData) return;
    const finalAmount = Number(amountUgx);
    if (!finalAmount || finalAmount <= 0) {
      setError("Please enter a valid fuel amount.");
      return;
    }

    if (finalAmount > codeData.authorized_amount_ugx) {
      setError(`Amount exceeds limit of ${ugx(codeData.authorized_amount_ugx)}`);
      return;
    }

    setDispensing(true);
    setError(null);

    try {
      const res = await api.dispenseGas({
        code: codeData.code,
        outletId: outlet?.id ?? "fout_total_lugogo",
        productId: selectedProductId,
        totalUgx: finalAmount,
        litres: Number(litres),
        pumpNumber,
        attendantName: attendant?.name ?? "Pump Attendant",
      });

      if (res.ok) {
        setCompletedReceipt(res.receipt);
        void refreshShift();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setDispensing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
          <p className="text-xs font-bold text-ink-500">Verifying fuel voucher…</p>
        </div>
      </div>
    );
  }

  // Digital Receipt Completed View
  if (completedReceipt) {
    return (
      <div className="space-y-4 pb-6">
        <div className="rounded-2xl border border-green/30 bg-green/10 p-4 text-center dark:bg-green/20">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green" />
          <h1 className="mt-2 text-xl font-black text-ink">Fuel Dispensed Successfully</h1>
          <p className="text-xs font-semibold text-green">
            Digital receipt signed & authorized
          </p>
        </div>

        {/* Printable / Shareable Digital Receipt */}
        <section className="home-card space-y-4 border-2 border-gold/40">
          <div className="flex items-center justify-between border-b border-[var(--border-faint)] pb-3">
            <div className="flex items-center gap-2">
              <BrandLogo wordmark={false} className="!h-8 !w-8" />
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-gold">Official Receipt</span>
                <p className="font-mono text-xs font-bold text-ink">
                  {completedReceipt.receipt_ref}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-ink">
                {completedReceipt.station_name}
              </span>
              <p className="text-[10px] text-ink-500">{completedReceipt.outlet_name}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-ink-500">Customer / Plate</span>
              <p className="font-bold text-ink">
                {completedReceipt.rider_name} · {completedReceipt.vehicle_plate}
              </p>
            </div>
            <div>
              <span className="text-ink-500">Pump & Attendant</span>
              <p className="font-bold text-ink">
                Pump {completedReceipt.pump_number} · {completedReceipt.attendant_name}
              </p>
            </div>
            <div>
              <span className="text-ink-500">Fuel Product</span>
              <p className="font-bold text-ink">{completedReceipt.product_name}</p>
            </div>
            <div>
              <span className="text-ink-500">Pump Rate</span>
              <p className="font-bold text-ink">{ugx(completedReceipt.price_per_litre)} / L</p>
            </div>
          </div>

          {/* Large Totals Badge */}
          <div className="rounded-2xl border border-gold/30 bg-gold/10 p-3.5 text-center">
            <span className="text-xs font-bold text-ink-500">
              Total Volume Dispensed: <strong>{completedReceipt.litres_dispensed} Litres</strong>
            </span>
            <div className="text-2xl font-black text-ink">
              {ugx(completedReceipt.total_ugx)}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <QrCode value={receiptUrl(completedReceipt.receipt_ref)} size={132} className="border border-[var(--border-faint)] p-1" label={`QR code to verify receipt ${completedReceipt.receipt_ref}`} />
            <p className="text-center text-[10px] text-ink-500">Scan to check this receipt is genuine</p>
          </div>

          <p className="text-center font-mono text-[10px] text-ink-500">
            {new Date(completedReceipt.created_at).toLocaleString()} · Peebee Gas Concierge
          </p>
        </section>

        {/* Action Buttons */}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex min-h-13 flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] font-bold text-ink shadow-[var(--shadow-card)] active:scale-95 transition"
          >
            <Printer className="h-4 w-4" />
            <span>Print Receipt</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex min-h-13 flex-1 items-center justify-center rounded-2xl bg-gold font-bold text-ink-gold shadow-[var(--shadow-glow-gold)] active:scale-[0.98] transition"
          >
            <span>Next Customer →</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Back button */}
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] text-ink hover:border-gold transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-black text-ink">Dispense Fuel</h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Verified Customer Card */}
      {codeData && (
        <section className="home-card space-y-3 !border-l-4 !border-l-green">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-ink">
                {codeData.vehicle_type === "car" ||
                codeData.vehicle_desc?.toLowerCase().includes("car") ||
                codeData.vehicle_plate.startsWith("UB") ||
                codeData.vehicle_plate.startsWith("UA") ? (
                  <CarFront className="h-6 w-6 text-gold" />
                ) : (
                  <Bike className="h-6 w-6 text-gold" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-black text-ink">{codeData.rider_name}</h2>
                  <ShieldCheck className="h-4 w-4 text-green" />
                </div>
                <p className="text-xs text-ink-500">
                  {codeData.vehicle_desc ? `${codeData.vehicle_desc} · ` : ""}
                  {codeData.rider_stage}
                </p>
              </div>
            </div>

            {/* Uganda Vehicle Registration Plate Badge */}
            <div className="rounded-lg border-2 border-black bg-[#FFD700] px-2.5 py-1 text-center font-mono text-xs font-black tracking-wider text-black shadow-sm">
              {codeData.vehicle_plate}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border-faint)] pt-2.5 text-xs">
            <span className="text-ink-500">Authorized Limit</span>
            <strong className="text-sm font-black text-green">
              {ugx(codeData.authorized_amount_ugx)}
            </strong>
          </div>
        </section>
      )}

      {/* Fuel Product Selector */}
      <section className="home-card space-y-3">
        <label className="text-xs font-bold text-ink-500">Select Fuel Product</label>
        <div className="grid grid-cols-2 gap-2">
          {prices.map((p) => {
            const isSelected = p.product_id === selectedProductId;
            return (
              <button
                key={p.product_id}
                type="button"
                onClick={() => handleProductChange(p.product_id)}
                className={`flex flex-col items-start rounded-2xl border p-3 text-left transition ${
                  isSelected
                    ? "border-gold bg-gold/10 text-ink ring-2 ring-gold"
                    : "border-[var(--border-faint)] bg-[rgb(var(--surface-input))] text-ink hover:border-gold/40"
                }`}
              >
                <span className="text-xs font-black">{p.product_name}</span>
                <span className="mt-1 text-xs font-bold text-gold">
                  {ugx(p.price_per_unit)} / L
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Litres <-> UGX Dispense Calculator */}
      <section className="home-card space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-ink-500">Refuel Amount</label>
          <span className="text-xs text-ink-500 font-mono">
            Rate: {ugx(unitPrice)}/L
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="field-box flex-col items-start p-2.5">
            <span className="text-[10px] font-bold uppercase text-ink-500">Amount (UGX)</span>
            <input
              type="text"
              inputMode="numeric"
              value={amountUgx}
              onChange={(e) => handleUgxChange(e.target.value)}
              placeholder="e.g. 20000"
              className="w-full text-lg font-black text-ink"
            />
          </div>

          <div className="field-box flex-col items-start p-2.5">
            <span className="text-[10px] font-bold uppercase text-ink-500">Litres (L)</span>
            <input
              type="number"
              step="0.01"
              value={litres}
              onChange={(e) => handleLitresChange(e.target.value)}
              placeholder="e.g. 3.67"
              className="w-full text-lg font-black text-ink"
            />
          </div>
        </div>

        {/* Quick Amount Preset Chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[5000, 10000, 15000, 20000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleUgxChange(String(preset))}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                Number(amountUgx) === preset
                  ? "bg-gold text-ink-gold font-extrabold"
                  : "bg-gold/15 text-ink hover:bg-gold/25"
              }`}
            >
              {ugx(preset)}
            </button>
          ))}
          {codeData && (
            <button
              type="button"
              onClick={() => handleUgxChange(String(codeData.authorized_amount_ugx))}
              className="rounded-full bg-green/15 px-3 py-1.5 text-xs font-bold text-green hover:bg-green/25"
            >
              Full Quota ({ugx(codeData.authorized_amount_ugx)})
            </button>
          )}
        </div>

        {/* Pump lane selection */}
        <div className="flex items-center justify-between border-t border-[var(--border-faint)] pt-3 text-xs">
          <span className="text-ink-500">Pump Nozzle</span>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setPumpNumber(num)}
                className={`h-8 w-8 rounded-xl text-xs font-bold transition ${
                  pumpNumber === num
                    ? "bg-black-700 text-white dark:bg-gold dark:text-ink-gold shadow-sm"
                    : "border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] text-ink"
                }`}
              >
                P{num}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Confirm Dispense Button */}
      <button
        type="button"
        disabled={dispensing || !Number(amountUgx)}
        onClick={handleConfirmDispense}
        className="min-h-14 w-full rounded-2xl bg-gold text-base font-bold text-ink-gold shadow-[var(--shadow-glow-gold)] transition active:scale-[0.98] disabled:opacity-40"
      >
        {dispensing ? "Dispensing fuel…" : `Confirm & Dispense ${ugx(Number(amountUgx) || 0)}`}
      </button>
    </div>
  );
}

export default function DispensePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs">Loading…</div>}>
      <DispenseContent />
    </Suspense>
  );
}
