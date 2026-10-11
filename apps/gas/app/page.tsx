"use client";

import { AlertCircle, Camera, CheckCircle2, ChevronRight, Fuel, QrCode, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Numpad } from "../components/Numpad";
import { QrScanner } from "../components/QrScanner";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth-context";

export default function PumpHomePage() {
  const router = useRouter();
  const { attendant, outlet, shiftSummary, refreshShift } = useAuth();
  const [code, setCode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify(codeToVerify: string) {
    const trimmed = codeToVerify.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter or scan a code first.");
      return;
    }
    setBusy(true);
    setError(null);

    try {
      const res = await api.verifyGasCode(trimmed, outlet?.id);
      if (res.valid) {
        // Navigate to dispense screen with validated code
        router.push(`/dispense?code=${encodeURIComponent(trimmed)}`);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function handleQrScan(scannedValue: string) {
    setScannerOpen(false);
    setCode(scannedValue);
    void handleVerify(scannedValue);
  }

  const ugx = (amount: number) => `UGX ${Number(amount).toLocaleString()}`;

  return (
    <div className="space-y-4">
      {/* Shift Overview Ticker */}
      <section className="home-card !bg-navy text-white shadow-md dark:!bg-[#153A75]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-white/70">Attendant Shift · Today</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">
              {ugx(shiftSummary?.total_ugx ?? 0)}
            </h2>
          </div>
          <Link
            href="/shift"
            className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white transition hover:bg-white/25"
          >
            <span>Shift log</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-3 flex items-center gap-4 border-t border-white/15 pt-3 text-xs text-white/80">
          <div>
            <span className="text-white/60">Pumped: </span>
            <strong>{(shiftSummary?.total_litres ?? 0).toFixed(2)} L</strong>
          </div>
          <div>
            <span className="text-white/60">Dispenses: </span>
            <strong>{shiftSummary?.total_dispenses ?? 0} refuels</strong>
          </div>
        </div>
      </section>

      {/* Primary Pump Actions */}
      <section className="home-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gold">Pump Lane</span>
            <h1 className="text-lg font-black text-ink">
              {outlet?.name ?? "Petrol Station"} · {attendant?.pump_lane ?? "Pump 1"}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-gold px-4 py-2.5 text-xs font-bold text-ink-gold shadow transition hover:opacity-95"
          >
            <Camera className="h-4 w-4" />
            <span>Scan QR</span>
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 6-Digit Code Display */}
        <div className="space-y-1.5 text-center">
          <label className="text-xs font-bold text-ink-500">
            Enter 6-digit fuel code from rider
          </label>
          <div className="flex justify-center gap-2">
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const char = code.replace(/^PBGAS-/, "")[index] ?? "";
              return (
                <div
                  key={index}
                  className={`flex h-13 w-11 items-center justify-center rounded-xl border text-xl font-black transition ${
                    char
                      ? "border-gold bg-gold/10 text-ink"
                      : "border-[var(--border-faint)] bg-[rgb(var(--surface-input))] text-ink-500"
                  }`}
                >
                  {char || "·"}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tactical Outdoor Numpad */}
        <Numpad
          value={code.replace(/^PBGAS-/, "")}
          onChange={(val) => {
            setCode(val);
            if (error) setError(null);
            if (val.length === 6) {
              void handleVerify(val);
            }
          }}
          maxLength={6}
          confirmLabel={busy ? "Checking code…" : "Verify Rider Code"}
          confirmDisabled={busy || code.replace(/^PBGAS-/, "").length < 6}
          onConfirm={() => handleVerify(code)}
        />
      </section>

      {/* Quick Testing & Simulator Helpers */}
      <section className="rounded-2xl border border-dashed border-[var(--border-faint)] bg-gold/5 p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" />
            <span className="text-xs font-bold text-ink">Demo Rider Code Ready:</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setCode("738291");
              void handleVerify("738291");
            }}
            className="rounded-lg bg-gold/20 px-2.5 py-1 text-xs font-black text-gold hover:bg-gold/30"
          >
            Use 738291 (Okello R.)
          </button>
        </div>
      </section>

      {/* Current Station Pump Prices Board */}
      <section className="home-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fuel className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-bold text-ink">Today's Pump Prices</h3>
          </div>
          <Link href="/prices" className="text-xs font-bold text-gold">
            Adjust board →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(outlet?.prices ?? []).slice(0, 4).map((price) => (
            <div
              key={price.product_id}
              className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] p-2.5 text-center"
            >
              <span className="block text-[11px] font-semibold text-ink-500 line-clamp-1">
                {price.product_name}
              </span>
              <strong className="text-sm font-black text-ink">
                {ugx(price.price_per_unit)}
              </strong>
              <span className="text-[10px] text-ink-500"> / {price.unit}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Live Camera Scanner Modal */}
      {scannerOpen && (
        <QrScanner
          onScan={handleQrScan}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
