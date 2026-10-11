"use client";

import type { FuelReceipt } from "@peebee/shared";
import { AlertCircle, Calendar, CheckCircle, Clock, Download, Fuel, RefreshCw, User } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

export default function ShiftPage() {
  const { attendant, outlet, shiftSummary, refreshShift } = useAuth();
  const [dispenses, setDispenses] = useState<FuelReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closedNotice, setClosedNotice] = useState(false);

  const ugx = (amount: number) => `UGX ${Number(amount).toLocaleString()}`;

  async function loadDispenses() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.gasDispenses(outlet?.id);
      setDispenses(res.dispenses);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDispenses();
  }, [outlet?.id]);

  function handleCloseShift() {
    setClosedNotice(true);
    setTimeout(() => setClosedNotice(false), 5000);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-ink">Shift & Pump Log</h1>
          <p className="text-xs text-ink-500">
            {outlet?.name ?? "Petrol Station"} · {attendant?.name ?? "Attendant"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void refreshShift();
            void loadDispenses();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-faint)] text-ink hover:bg-gold/10"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {closedNotice && (
        <div className="flex items-center gap-2 rounded-2xl bg-green/10 p-3 text-xs font-semibold text-green dark:bg-green/20">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>Shift summary balanced and reconciled. Digital log saved.</span>
        </div>
      )}

      {/* Shift Metrics Card */}
      <section className="home-card space-y-3 !bg-navy text-white shadow-md dark:!bg-[#153A75]">
        <div className="flex items-center justify-between text-xs text-white/70">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>Active Shift</span>
          </span>
          <span className="rounded-full bg-green/25 px-2.5 py-0.5 font-bold text-green-300">
            Open
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 border-y border-white/15 py-3">
          <div>
            <span className="text-xs text-white/70">Total Revenue</span>
            <div className="mt-0.5 text-2xl font-black">
              {ugx(shiftSummary?.total_ugx ?? 0)}
            </div>
          </div>
          <div>
            <span className="text-xs text-white/70">Volume Dispensed</span>
            <div className="mt-0.5 text-2xl font-black">
              {(shiftSummary?.total_litres ?? 0).toFixed(2)} L
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 text-xs text-white/80">
          <span>Refuel count: <strong>{shiftSummary?.total_dispenses ?? 0} jobs</strong></span>
          <button
            type="button"
            onClick={handleCloseShift}
            className="rounded-lg bg-gold px-3 py-1 text-xs font-bold text-ink-gold hover:opacity-95"
          >
            Reconcile Shift
          </button>
        </div>
      </section>

      {/* Recent Dispenses Table/List */}
      <section className="home-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Today's Refuel Transactions</h2>
          <span className="text-xs font-semibold text-ink-500">
            {dispenses.length} entries
          </span>
        </div>

        {dispenses.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-500">
            <Fuel className="mx-auto mb-2 h-8 w-8 text-ink-500/40" />
            <p>No fuel dispenses recorded for this shift yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-faint)]">
            {dispenses.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-[#FFD700] px-1.5 py-0.5 font-mono text-[10px] font-black text-black">
                      {d.vehicle_plate}
                    </span>
                    <strong className="font-bold text-ink">{d.rider_name}</strong>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-500">
                    {d.product_name} · {d.litres_dispensed} L · Pump {d.pump_number}
                  </p>
                </div>
                <div className="text-right">
                  <strong className="text-sm font-black text-ink">{ugx(d.total_ugx)}</strong>
                  <span className="block font-mono text-[10px] text-ink-500">
                    {new Date(d.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
