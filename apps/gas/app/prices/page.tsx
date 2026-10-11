"use client";

import type { FuelOutletPrice } from "@peebee/shared";
import { AlertCircle, CheckCircle2, DollarSign, Fuel, Info, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

export default function PricesPage() {
  const { outlet, refreshOutlets } = useAuth();
  const [prices, setPrices] = useState<FuelOutletPrice[]>([]);
  const [editing, setEditing] = useState(false);
  const [editedPrices, setEditedPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ugx = (amount: number) => `UGX ${Number(amount).toLocaleString()}`;

  useEffect(() => {
    if (outlet?.prices) {
      setPrices(outlet.prices);
      const map: Record<string, string> = {};
      for (const p of outlet.prices) {
        map[p.product_id] = String(p.price_per_unit);
      }
      setEditedPrices(map);
    }
  }, [outlet]);

  async function handleSave() {
    if (!outlet) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updates = prices.map((p) => ({
        product_id: p.product_id,
        price_per_unit: Number(editedPrices[p.product_id]) || p.price_per_unit,
      }));

      await api.updateGasOutletPrices(outlet.id, updates);
      await refreshOutlets();
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-ink">Station Pump Prices</h1>
          <p className="text-xs text-ink-500">
            {outlet?.name ?? "Petrol Station"} · Live Board
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full bg-gold px-3.5 py-1.5 text-xs font-bold text-ink-gold hover:opacity-95"
          >
            Edit Prices
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full border border-[var(--border-faint)] px-3 py-1.5 text-xs font-bold text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-xs font-bold text-ink-gold"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? "Saving…" : "Save"}</span>
            </button>
          </div>
        )}
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-2xl bg-green/10 p-3 text-xs font-semibold text-green dark:bg-green/20">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Pump price board updated successfully. Live for all riders.</span>
        </div>
      )}

      {/* Pump Price Cards */}
      <section className="space-y-2.5">
        {prices.map((item) => (
          <div
            key={item.product_id}
            className="home-card flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
                <Fuel className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">{item.product_name}</h3>
                <span className="text-[11px] font-semibold text-ink-500 uppercase">
                  Category: {item.category}
                </span>
              </div>
            </div>

            <div>
              {editing ? (
                <div className="field-box flex items-center gap-1 px-2.5 py-1">
                  <span className="text-xs font-bold text-ink-500">UGX</span>
                  <input
                    type="number"
                    value={editedPrices[item.product_id] ?? ""}
                    onChange={(e) =>
                      setEditedPrices((prev) => ({
                        ...prev,
                        [item.product_id]: e.target.value,
                      }))
                    }
                    className="w-24 text-right text-sm font-black text-ink outline-none"
                  />
                  <span className="text-[11px] text-ink-500">/L</span>
                </div>
              ) : (
                <div className="text-right">
                  <strong className="text-base font-black text-ink">
                    {ugx(item.price_per_unit)}
                  </strong>
                  <span className="block text-[10px] text-ink-500">per litre</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Regional Regulatory Benchmark Notice */}
      <section className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3.5 text-xs text-ink-500 space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-ink">
          <Info className="h-4 w-4 text-gold" />
          <span>Uganda Fuel Price Benchmark (Kampala Metropolitan)</span>
        </div>
        <p>
          Pump rates sync with the live Peebee Rider app so riders can see transparent, real-time rates before navigating to your petrol station pump lane.
        </p>
      </section>
    </div>
  );
}
